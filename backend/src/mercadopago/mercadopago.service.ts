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
    if (!configRec?.mpAccessToken) throw new BadRequestException('MercadoPago no configurado para esta empresa');
    if (!configRec?.mpUserId) throw new BadRequestException('User ID de MercadoPago no encontrado. Reconectá tu cuenta.');

    const payment = await this.prisma.payment.findFirst({
      where: { id: dto.paymentId, companyId },
      include: { client: true, items: true },
    });
    if (!payment) throw new NotFoundException('Pago no encontrado');

    const externalPosId = `pos_${companyId.slice(-8)}`;
    
    const qrPayload = {
      external_reference: payment.id,
      title: dto.description || `Pago Veterinaria #${payment.id.slice(-6)}`,
      description: dto.description || `Servicios veterinarios`,
      notification_url: `${this.config.get('BACKEND_URL')}/api/v1/payments/webhook`,
      total_amount: dto.amount || payment.totalAmount,
      items: payment.items?.length ? payment.items.map(item => ({
        sku_number: item.id.slice(-8),
        category: 'services',
        title: item.description,
        description: item.description,
        unit_price: item.unitPrice,
        quantity: item.quantity,
        unit_measure: 'unit',
        total_amount: item.totalPrice,
      })) : [{
        sku_number: 'SRV001',
        category: 'services',
        title: dto.description || 'Servicio veterinario',
        description: dto.description || 'Servicio veterinario',
        unit_price: dto.amount || payment.totalAmount,
        quantity: 1,
        unit_measure: 'unit',
        total_amount: dto.amount || payment.totalAmount,
      }],
      cash_out: { amount: 0 },
    };

    const mpUserId = configRec.mpUserId;
    let accessToken = configRec.mpAccessToken;

    const makeRequest = async (token: string) => {
      return fetch(
        `https://api.mercadopago.com/instore/orders/qr/seller/collectors/${mpUserId}/pos/${externalPosId}/qrs`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(qrPayload),
        }
      );
    };

    let response = await makeRequest(accessToken);

    if (response.status === 401) {
      try {
        accessToken = await this.refreshOAuthToken(companyId);
        response = await makeRequest(accessToken);
      } catch { throw new BadRequestException('Token de MercadoPago expirado. Reconectá tu cuenta.'); }
    }

    if (!response.ok) {
      const errorText = await response.text();
      this.logger.error(`Error QR MP: ${errorText}`);
      
      if (errorText.includes('pos') || errorText.includes('404') || response.status === 404) {
        await this.ensurePosExists(companyId, mpUserId, externalPosId, accessToken);
        response = await makeRequest(accessToken);
        if (!response.ok) {
          const err2 = await response.text();
          this.logger.error(`Error QR MP (retry): ${err2}`);
          throw new BadRequestException('Error al generar código QR de MercadoPago');
        }
      } else {
        throw new BadRequestException('Error al generar código QR de MercadoPago');
      }
    }

    const result = await response.json();
    return { 
      qrData: result.qr_data, 
      orderId: result.in_store_order_id,
      amount: dto.amount || payment.totalAmount,
    };
  }

  private async ensurePosExists(companyId: string, mpUserId: string, externalPosId: string, accessToken: string) {
    const storePayload = {
      name: 'Sucursal Principal',
      external_id: `store_${companyId.slice(-8)}`,
    };
    const storeRes = await fetch(`https://api.mercadopago.com/users/${mpUserId}/stores`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify(storePayload),
    });
    const store = storeRes.ok ? await storeRes.json() : null;
    
    const posPayload = {
      name: 'Caja Principal',
      external_id: externalPosId,
      category: 621102,
      store_id: store?.id,
      fixed_amount: false,
    };
    await fetch(`https://api.mercadopago.com/pos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify(posPayload),
    });
    this.logger.log(`POS creado para empresa ${companyId}`);
  }

  async handleWebhook(topicOrType: string, id: string) {
    // Normalize topic/type - MP can send topic as query param or type in body
    let topic = topicOrType;
    if (topicOrType === 'payment.created' || topicOrType === 'payment.updated') {
      topic = 'payment';
    }
    
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

  async handleOAuthCallback(companyId: string, code: string) {
    const MP_APP_ID = this.config.get('MP_APP_ID');
    const MP_CLIENT_SECRET = this.config.get('MP_CLIENT_SECRET');

    const response = await fetch('https://api.mercadopago.com/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${MP_CLIENT_SECRET}`,
      },
      body: JSON.stringify({
        client_id: MP_APP_ID,
        client_secret: MP_CLIENT_SECRET,
        grant_type: 'authorization_code',
        code,
        redirect_uri: `${this.config.get('BACKEND_URL')}/api/v1/mercadopago/oauth/callback`,
      }),
    });
    if (!response.ok) {
      const err = await response.text();
      this.logger.error(`OAuth callback error: ${err}`);
      throw new BadRequestException('Error al vincular cuenta de MercadoPago');
    }
    const data = await response.json();
    
    const userRes = await fetch(`https://api.mercadopago.com/users/${data.user_id}`, {
      headers: { Authorization: `Bearer ${data.access_token}` }
    });
    const mpUser = userRes.ok ? await userRes.json() : null;

    await this.prisma.companyConfig.update({
      where: { companyId },
      data: {
        mpAccessToken: data.access_token,
        mpRefreshToken: data.refresh_token,
        mpPublicKey: data.public_key,
        mpUserId: String(data.user_id),
        mpNickname: mpUser?.nickname || null,
      },
    });
    this.logger.log(`MP OAuth vinculado para empresa ${companyId}, user_id: ${data.user_id}`);
    return { success: true };
  }

  async refreshOAuthToken(companyId: string) {
    const config = await this.prisma.companyConfig.findUnique({ where: { companyId } });
    if (!config?.mpRefreshToken) throw new BadRequestException('No hay refresh token guardado');
    
    const MP_APP_ID = this.config.get('MP_APP_ID');
    const MP_CLIENT_SECRET = this.config.get('MP_CLIENT_SECRET');

    const response = await fetch('https://api.mercadopago.com/oauth/token', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${MP_CLIENT_SECRET}`
      },
      body: JSON.stringify({
        client_id: MP_APP_ID,
        client_secret: MP_CLIENT_SECRET,
        grant_type: 'refresh_token',
        refresh_token: config.mpRefreshToken,
      }),
    });
    if (!response.ok) throw new BadRequestException('Error renovando token de MercadoPago');
    const data = await response.json();
    await this.prisma.companyConfig.update({
      where: { companyId },
      data: {
        mpAccessToken: data.access_token,
        mpRefreshToken: data.refresh_token,
      },
    });
    return data.access_token;
  }

  async disconnectOAuth(companyId: string) {
    await this.prisma.companyConfig.update({
      where: { companyId },
      data: {
        mpAccessToken: null,
        mpRefreshToken: null,
        mpPublicKey: null,
        mpUserId: null,
        mpNickname: null,
      },
    });
    return { success: true };
  }

  async getOAuthStatus(companyId: string) {
    const config = await this.prisma.companyConfig.findUnique({ where: { companyId } });
    return {
      connected: !!(config?.mpAccessToken),
      nickname: config?.mpNickname || null,
      userId: config?.mpUserId || null,
    };
  }
}