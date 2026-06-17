import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private apiKey: string;
  private apiSecret: string;

  constructor(
    private config: ConfigService,
    private prisma: PrismaService,
  ) {
    this.apiKey = this.config.get<string>('MJ_APIKEY') || '';
    this.apiSecret = this.config.get<string>('MJ_APISECRET') || '';
  }

  private getClient() {
    if (!this.apiKey || !this.apiSecret) return null;
    const mailjet = require('node-mailjet');
    return mailjet.connect(this.apiKey, this.apiSecret);
  }

  async sendEmail(to: string | string[], subject: string, html: string, from?: string, fromName?: string) {
    const client = this.getClient();
    if (!client) {
      this.logger.warn('Mailjet no configurado, email no enviado');
      return { sent: false, reason: 'not_configured' };
    }

    const recipients = Array.isArray(to) ? to.map((e) => ({ Email: e })) : [{ Email: to }];
    const sender = from || this.config.get('MJ_SENDER_EMAIL') || 'noreply@patasoft.com';
    const senderName = fromName || this.config.get('MJ_SENDER_NAME') || 'PataSoft';

    try {
      const result = await client.post('send').request({
        FromEmail: sender,
        FromName: senderName,
        Subject: subject,
        'Html-part': html,
        'Recipients': recipients,
      });

      this.logger.log(`Email enviado a ${to}`);
      return { sent: true, messageId: result.body?.Messages?.[0]?.To?.[0]?.MessageID };
    } catch (error: any) {
      this.logger.error(`Error enviando email: ${error.message}`);
      return { sent: false, error: error.message };
    }
  }

  async sendDebtReminder(clientEmail: string, clientName: string, debtAmount: number, dueDate: Date, companyName: string) {
    const subject = `Recordatorio: Deuda pendiente - ${companyName}`;
    const html = `
      <h2>Hola ${clientName},</h2>
      <p>Te recordamos que tienes una deuda pendiente de <strong>$${debtAmount.toFixed(2)}</strong> con ${companyName}.</p>
      <p>Fecha de vencimiento: ${dueDate.toLocaleDateString('es-AR')}</p>
      <p>Por favor, acercóte a regularizar tu cuenta.</p>
      <p>Saludos,<br>${companyName}</p>
    `;
    return this.sendEmail(clientEmail, subject, html);
  }

  async sendPaymentReceipt(clientEmail: string, clientName: string, amount: number, paymentId: string, companyName: string) {
    const subject = `Comprobante de pago - ${companyName}`;
    const html = `
      <h2>Hola ${clientName},</h2>
      <p>Te confirmamos que hemos recibido tu pago de <strong>$${amount.toFixed(2)}</strong>.</p>
      <p>ID de transacción: ${paymentId}</p>
      <p>Saludos,<br>${companyName}</p>
    `;
    return this.sendEmail(clientEmail, subject, html);
  }

  async sendLowStockAlert(adminEmail: string, supplyName: string, quantity: number, minQuantity: number, companyName: string) {
    const subject = `Alerta de stock bajo - ${supplyName}`;
    const html = `
      <h2>Alerta de stock bajo</h2>
      <p>El insumo <strong>${supplyName}</strong> tiene solo <strong>${quantity}</strong> unidades (mínimo: ${minQuantity}).</p>
      <p>Por favor, reponé el stock.</p>
    `;
    return this.sendEmail(adminEmail, subject, html);
  }
}