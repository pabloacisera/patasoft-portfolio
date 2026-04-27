import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSubscriptionCheckoutDto, SubscriptionPlanDto } from './dto/subscriptions.dto';

const MP_BASE_URL = 'https://api.mercadopago.com';

@Injectable()
export class SubscriptionsService {
  private readonly logger = new Logger(SubscriptionsService.name);

  constructor(
    private config: ConfigService,
    private prisma: PrismaService,
  ) {}

  async getStatus(companyId: string) {
    const subscription = await this.prisma.subscription.findUnique({
      where: { companyId },
    });

    if (!subscription) {
      throw new NotFoundException('Suscripción no encontrada');
    }

    return subscription;
  }

  async createCheckout(companyId: string, dto: CreateSubscriptionCheckoutDto) {
    const mpAccessToken = this.config.get('MP_ACCESS_TOKEN');
    if (!mpAccessToken) {
      throw new BadRequestException('MercadoPago no configurado en el servidor');
    }

    const company = await this.prisma.company.findUnique({ where: { id: companyId } });
    if (!company) throw new NotFoundException('Empresa no encontrada');

    const amount = dto.plan === SubscriptionPlanDto.MONTHLY ? 5000 : 50000; // Precios de ejemplo
    const title = `Suscripción PataSoft - ${dto.plan === SubscriptionPlanDto.MONTHLY ? 'Mensual' : 'Anual'}`;

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
        success: `${this.config.get('FRONTEND_URL')}/settings/subscription?success=true`,
        failure: `${this.config.get('FRONTEND_URL')}/settings/subscription?error=true`,
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
      throw new BadRequestException('Error al crear preferencia de suscripción');
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
    if (data.type === 'payment' && data.data?.id) {
      const response = await fetch(`${MP_BASE_URL}/v1/payments/${data.data.id}`, {
        headers: { Authorization: `Bearer ${mpAccessToken}` },
      });

      if (response.ok) {
        const paymentData = await response.json();
        const externalRef = paymentData.external_reference;
        
        try {
          const parsed = JSON.parse(externalRef);
          if (parsed.type === 'subscription') {
            const { companyId, plan } = parsed;
            
            if (paymentData.status === 'approved') {
              await this.activateSubscription(companyId, plan);
            }
          }
        } catch (e) {
          this.logger.error(`Error parsing external_reference: ${externalRef}`);
        }
      }
    }

    return { received: true };
  }

  private async activateSubscription(companyId: string, plan: SubscriptionPlanDto) {
    const expiresAt = new Date();
    if (plan === SubscriptionPlanDto.MONTHLY) {
      expiresAt.setMonth(expiresAt.getMonth() + 1);
    } else {
      expiresAt.setFullYear(expiresAt.getFullYear() + 1);
    }

    await this.prisma.$transaction([
      this.prisma.subscription.update({
        where: { companyId },
        data: {
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

  async cancel(companyId: string) {
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
    }
  }
}
