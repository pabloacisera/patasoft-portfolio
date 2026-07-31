import { Injectable, NotFoundException, BadRequestException, Logger, forwardRef, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { CreateSubscriptionCheckoutDto, SubscriptionPlanDto } from './dto/subscriptions.dto';
import { EventsGateway } from '../events/events.gateway';

const MP_BASE_URL = 'https://api.mercadopago.com';

@Injectable()
export class SubscriptionsService {
  private readonly logger = new Logger(SubscriptionsService.name);

  constructor(
    private config: ConfigService,
    private prisma: PrismaService,
    private redis: RedisService,
    // forwardRef necesario: dependencia circular SubscriptionsService -> EventsGateway
    @Inject(forwardRef(() => EventsGateway))
    private eventsGateway: EventsGateway,
  ) {}

  async getStatus(companyId: number) {
    const subscription = await this.prisma.subscription.findUnique({
      where: { companyId },
    });

    if (!subscription) {
      throw new NotFoundException('Suscripción no encontrada');
    }

    return {
      ...subscription,
      trialEndsAt: subscription.trialEndsAt?.toISOString() ?? null,
      expiresAt: subscription.expiresAt?.toISOString() ?? null,
      startedAt: subscription.startedAt.toISOString(),
      createdAt: subscription.createdAt.toISOString(),
      updatedAt: subscription.updatedAt.toISOString(),
    };
  }

  async createCheckout(companyId: number, dto: CreateSubscriptionCheckoutDto) {
    const mpAccessToken = this.config.get('MP_ACCESS_TOKEN');
    if (!mpAccessToken) {
      throw new BadRequestException('MercadoPago no configurado en el servidor');
    }

    const company = await this.prisma.company.findUnique({ where: { id: companyId } });
    if (!company) throw new NotFoundException('Empresa no encontrada');

    let amount: number;
    let title: string;
    if ((dto.plan as string) === 'TEST') {
      amount = 150;
      title = 'Suscripción PataSoft - TEST 2 días';
    } else {
      amount = dto.plan === SubscriptionPlanDto.MONTHLY
        ? Number(this.config.get('MP_PLAN_MONTHLY_PRICE'))
        : Number(this.config.get('MP_PLAN_YEARLY_PRICE'));
      title = `Suscripción PataSoft - ${dto.plan === SubscriptionPlanDto.MONTHLY ? 'Mensual' : 'Anual'}`;
    }

    const preference = {
      items: [
        {
          title,
          quantity: 1,
          unit_price: amount,
          currency_id: 'ARS',
        },
      ],
      external_reference: JSON.stringify({ type: 'subscription', companyId, plan: dto.plan }),
      notification_url: `${this.config.get('BACKEND_URL')}/api/v1/subscriptions/webhook`,
      back_urls: {
        success: this.config.get('MP_SUCCESS_URL'),
        failure: this.config.get('MP_FAILURE_URL'),
        pending: this.config.get('MP_PENDING_URL'),
      },
      auto_return: 'approved',
    };

    const response = await fetch(`${MP_BASE_URL}/checkout/preferences`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${mpAccessToken}`,
      },
      body: JSON.stringify(preference),
    });

    if (!response.ok) {
      const error = await response.text();
      this.logger.error(`Error creating subscription preference: ${error}`);
      throw new BadRequestException(`Error MP: ${error}`);
    }

    const result = await response.json();
    return {
      initPoint: result.init_point,
    };
  }

  async handleWebhook(data: any, signature?: string, requestId?: string) {
    this.logger.log(`Subscription webhook received: ${JSON.stringify(data)}`);
    
    // Validar firma de MercadoPago (opcional pero recomendado)
    // TODO: implementar validación de x-signature si es necesario
    
    const mpAccessToken = this.config.get('MP_ACCESS_TOKEN');
    const paymentId = data.data?.id || (data.topic === 'payment' ? data.resource : null);
    if ((data.type === 'payment' || data.topic === 'payment') && paymentId && !String(paymentId).startsWith('http')) {
      const response = await fetch(`${MP_BASE_URL}/v1/payments/${paymentId}`, {
        headers: { Authorization: `Bearer ${mpAccessToken}` },
      });

      if (response.ok) {
        const paymentData = await response.json();
        const externalRef = paymentData.external_reference;
        
        try {
          const parsed = typeof externalRef === 'string' ? JSON.parse(externalRef) : externalRef;
          if (parsed?.type === 'subscription') {
            const { companyId, plan } = parsed;
            
            if (paymentData.status === 'approved') {
              await this.activateSubscription(companyId, plan);
            }
          }
        } catch (e) {
          this.logger.error(`Error processing webhook payment ${paymentId}: ${e.message}`);
          if (e.stack) this.logger.debug(e.stack);
        }
      }
    }

    return { received: true };
  }

  private async activateSubscription(companyId: number, plan: SubscriptionPlanDto) {
    const expiresAt = new Date();
    if ((plan as string) === 'TEST') {
      expiresAt.setDate(expiresAt.getDate() + 2);
    } else if (plan === SubscriptionPlanDto.MONTHLY) {
      expiresAt.setMonth(expiresAt.getMonth() + 1);
    } else {
      expiresAt.setFullYear(expiresAt.getFullYear() + 1);
    }

    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      include: { subscription: true }
    });

    if (!company) {
      this.logger.error(`Cannot activate subscription: Company ${companyId} not found`);
      return;
    }

    await this.prisma.$transaction([
      this.prisma.subscription.upsert({
        where: { companyId },
        create: {
          companyId,
          plan: plan as any,
          status: 'ACTIVE',
          expiresAt,
        },
        update: {
          plan: plan as any,
          status: 'ACTIVE',
          expiresAt,
          updatedAt: new Date(),
        },
      }),
      this.prisma.company.update({
        where: { id: companyId },
        data: { isBlocked: false, blockedReason: null },
      }),
    ]);

    this.logger.log(`Subscription activated for company ${companyId}`);
  }

  async cancel(companyId: number) {
    await this.prisma.subscription.update({
      where: { companyId },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
      },
    });

    return { message: 'Suscripción cancelada exitosamente' };
  }

  // Lógica de expiración (puede ser llamada por un cron job)
  async checkExpirations() {
    const now = new Date();
    const expiredSubs = await this.prisma.subscription.findMany({
      where: {
        status: { in: ['ACTIVE', 'TRIAL'] },
        OR: [
          { expiresAt: { lt: now } },
          { trialEndsAt: { lt: now } },
        ],
      },
      include: { company: true },
    });

    for (const sub of expiredSubs) {
      await this.prisma.$transaction([
        this.prisma.subscription.update({
          where: { id: sub.id },
          data: { status: 'EXPIRED' },
        }),
        this.prisma.company.update({
          where: { id: sub.companyId },
          data: {
            isBlocked: true,
            blockedReason: sub.status === 'TRIAL' ? 'Trial expirado' : 'Suscripción expirada',
          },
        }),
        // Crear notificación
        this.prisma.notification.create({
          data: {
            companyId: sub.companyId,
            type: sub.status === 'TRIAL' ? 'SUBSCRIPTION_EXPIRED' : 'SUBSCRIPTION_EXPIRED',
            title: 'Suscripción vencida',
            message: 'Tu cuenta ha sido bloqueada. Por favor, renueva tu suscripción.',
          },
        }),
      ]);
      this.logger.warn(`Subscription expired for company ${sub.companyId}`);
      await this.redis.del(`sub_status:${sub.companyId}`);
      try {
        this.eventsGateway.emitToCompany(sub.companyId, 'company:blocked', {
          reason: sub.status === 'TRIAL' ? 'Trial expirado' : 'Suscripción expirada',
        });
      } catch(e) {}
    }
  }
}
