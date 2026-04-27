import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePreferenceDto, QrPaymentDto, WebhookDto } from './dto/mercadopago.dto';

const MP_BASE_URL = 'https://api.mercadopago.com';

@Injectable()
export class MercadopagoService {
  private readonly logger = new Logger(MercadopagoService.name);

  constructor(
    private config: ConfigService,
    private prisma: PrismaService,
  ) {}

  async createPreference(companyId: string, dto: CreatePreferenceDto) {
    const configRec = await this.prisma.companyConfig.findUnique({ where: { companyId } });
    if (!configRec?.mpAccessToken) throw new BadRequestException('MercadoPago no configurado para esta empresa');

    const payment = await this.prisma.payment.findFirst({
      where: { id: dto.paymentId, companyId },
      include: { items: true, client: true },
    });
    if (!payment) throw new NotFoundException('Pago no encontrado');

    const preference = {
      items: [
        {
          title: dto.title || `PagoVeterinaria #${payment.id.slice(-6)}`,
          description: dto.description || `Pago para servicios veterinarios`,
          quantity: dto.quantity || 1,
          unit_price: dto.unitPrice || payment.totalAmount,
          currency_id: 'ARS',
        },
      ],
      payer: payment.client ? { email: payment.client.email } : undefined,
      payment_methods: { excluded_payment_methods: [], installments: 1 },
      external_reference: payment.id,
      notification_url: `${this.config.get('BACKEND_URL')}/api/v1/mercadopago/webhook`,
      back_urls: {
        success: `${this.config.get('FRONTEND_URL')}/payments/success`,
        failure: `${this.config.get('FRONTEND_URL')}/payments/failure`,
        pending: `${this.config.get('FRONTEND_URL')}/payments/pending`,
      },
    };

    const response = await fetch(`${MP_BASE_URL}/checkout/preferences`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${configRec.mpAccessToken}`,
      },
      body: JSON.stringify(preference),
    });

    if (!response.ok) {
      const error = await response.text();
      this.logger.error(`Error creating preference: ${error}`);
      throw new BadRequestException('Error al crear preferencia de pago');
    }

    const result = await response.json();
    await this.prisma.payment.update({
      where: { id: dto.paymentId },
      data: { method: 'MP_CHECKOUT' },
    });

    return {
      preferenceId: result.id,
      initPoint: result.init_point,
      sandboxInitPoint: result.sandbox_init_point,
    };
  }

  async createQrPayment(companyId: string, dto: QrPaymentDto) {
    const configRec = await this.prisma.companyConfig.findUnique({ where: { companyId } });
    if (!configRec?.mpAccessToken) throw new BadRequestException('MercadoPago no configurado');
    if (!configRec?.mpPublicKey) throw new BadRequestException('Public key no configurada');

    const payment = await this.prisma.payment.findFirst({
      where: { id: dto.paymentId, companyId },
      include: { client: true },
    });
    if (!payment) throw new NotFoundException('Pago no encontrado');

    const payload = {
      transaction_amount: dto.amount,
      description: dto.description || `PagoVeterinaria #${payment.id.slice(-6)}`,
      payment_method_id: 'QR',
      payer: {
        email: payment.client?.email || 'test@test.com',
        identification: payment.client?.dni ? { type: 'DNI', number: payment.client.dni } : undefined,
      },
      external_reference: payment.id,
      notification_url: `${this.config.get('BACKEND_URL')}/api/v1/mercadopago/webhook`,
    };

    const response = await fetch(`${MP_BASE_URL}/instore/qr/${configRec.mpPublicKey}/payments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${configRec.mpAccessToken}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const error = await response.text();
      this.logger.error(`Error creating QR payment: ${error}`);
      throw new BadRequestException('Error al crear pago QR');
    }

    const result = await response.json();
    return { qrToken: result.qr_token, qrImage: result.qr_image };
  }

  async handleWebhook(topic: string, id: string) {
    this.logger.log(`Webhook received: topic=${topic}, id=${id}`);

    if (topic === 'payment') {
      // Primero, buscar el pago para obtener el companyId
      // Hacemos una búsqueda por el ID del payment en MP para encontrar el external_reference
      const globalToken = this.config.get('MP_ACCESS_TOKEN');
      
      let paymentData;
      let externalRef;
      let companyId;
      
      // Intentar con token global para obtener datos del pago
      if (globalToken) {
        const response = await fetch(`${MP_BASE_URL}/v1/payments/${id}`, {
          headers: { Authorization: `Bearer ${globalToken}` },
        });

        if (response.ok) {
          paymentData = await response.json();
          externalRef = paymentData.external_reference;
          
          if (externalRef) {
            // Buscar el pago en nuestra DB para obter companyId
            const payment = await this.prisma.payment.findUnique({
              where: { id: externalRef },
              include: { debt: true },
            });

            if (payment) {
              companyId = payment.companyId;
              
              // Obtener la config de la empresa específica
              const configRec = await this.prisma.companyConfig.findUnique({ 
                where: { companyId } 
              });
              
              // Re-verificar el pago con el token de la empresa
              if (configRec?.mpAccessToken) {
                const verifyResponse = await fetch(`${MP_BASE_URL}/v1/payments/${id}`, {
                  headers: { Authorization: `Bearer ${configRec.mpAccessToken}` },
                });
                if (verifyResponse.ok) {
                  paymentData = await verifyResponse.json();
                }
              }

              // Actualizar el estado del pago
              const status = paymentData.status;
              if (status === 'approved') {
                await this.prisma.payment.update({
                  where: { id: externalRef },
                  data: { status: 'PAID', paidAmount: payment.totalAmount, paidAt: new Date(), mpPaymentId: id },
                });

                if (payment.debt) {
                  await this.prisma.debt.update({
                    where: { id: payment.debt.id },
                    data: { status: 'PAID', paidAt: new Date() },
                  });
                }
                this.logger.log(`Pago ${externalRef} aprobado para empresa ${companyId}`);
              } else if (status === 'pending') {
                await this.prisma.payment.update({
                  where: { id: externalRef },
                  data: { status: 'PENDING', mpPaymentId: id },
                });
                this.logger.log(`Pago ${externalRef} pendiente para empresa ${companyId}`);
              }
            }
          }
        }
      }
    }

    return { received: true };
  }

  async getPaymentStatus(mpPaymentId: string, companyId: string) {
    const configRec = await this.prisma.companyConfig.findUnique({ where: { companyId } });
    if (!configRec?.mpAccessToken) throw new BadRequestException('MercadoPago no configurado');

    const response = await fetch(`${MP_BASE_URL}/v1/payments/${mpPaymentId}`, {
      headers: { Authorization: `Bearer ${configRec.mpAccessToken}` },
    });

    if (!response.ok) throw new NotFoundException('Pago no encontrado en MercadoPago');
    return response.json();
  }
}