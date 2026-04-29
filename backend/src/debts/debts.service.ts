import { Injectable, NotFoundException, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { EventsGateway } from '../events/events.gateway';
import { CashRegisterService } from '../cash-register/cash-register.service';
import * as ExcelJS from 'exceljs';

@Injectable()
export class DebtsService {
  private readonly logger = new Logger(DebtsService.name);
  constructor(
    private prisma: PrismaService,
    private cloudinary: CloudinaryService,
    private events: EventsGateway,
    private cashService: CashRegisterService,
  ) {}

  async findAll(companyId: string, q: any = {}) {
    const page = Number(q.page) || 1;
    const limit = Number(q.limit) || 20;
    const status = q.status;
    const skip = (page - 1) * limit;
    const where: any = { companyId, ...(status && { status }) };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.debt.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' }, include: { client: true, payment: true } }),
      this.prisma.debt.count({ where }),
    ]);
    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(id: string, companyId: string) {
    const d = await this.prisma.debt.findFirst({ where: { id, companyId }, include: { client: true, payment: true } });
    if (!d) throw new NotFoundException('Deuda no encontrada');
    return d;
  }

  async cancel(id: string, companyId: string) {
    await this.findOne(id, companyId);
    return this.prisma.debt.update({ where: { id }, data: { status: 'CANCELLED', cancelledAt: new Date() } });
  }

  async markPaid(id: string, companyId: string, dto?: { method?: string }) {
    const debt = await this.findOne(id, companyId);
    const { amount: finalAmount, breakdown } = this.calculateDebtAmount(debt);
    
    await this.prisma.debt.update({
      where: { id },
      data: { 
        status: 'PAID', 
        paidAt: new Date(),
        amount: finalAmount,
      }
    });

    if (debt.paymentId) {
      await this.prisma.payment.update({
        where: { id: debt.paymentId },
        data: { status: 'PAID', paidAmount: finalAmount, paidAt: new Date() }
      });
    }

    this.logger.log(`Deuda ${id} pagada: ${breakdown}`);
    return { success: true, amount: finalAmount, breakdown };
  }

  calculateDebtAmount(debt: any): { amount: number; breakdown: string } {
    if (!debt.interestRate || !debt.originalAmount) {
      return { amount: debt.amount, breakdown: 'Sin interés' };
    }
    
    const createdAt = new Date(debt.createdAt);
    const today = new Date();
    const daysElapsed = Math.floor((today.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
    
    const monthlyRate = debt.interestRate / 100;
    const dailyRate = monthlyRate / 30;
    const totalInterest = debt.originalAmount * dailyRate * daysElapsed;
    const totalAmount = debt.originalAmount + totalInterest;
    
    const breakdown = `Capital: ${debt.originalAmount.toFixed(2)} + Interés ${debt.interestRate}%/mes por ${daysElapsed} días: ${totalInterest.toFixed(2)}`;
    return { amount: Math.round(totalAmount * 100) / 100, breakdown };
  }

  async getPreviewAmount(id: string, companyId: string) {
    const debt = await this.findOne(id, companyId);
    return this.calculateDebtAmount(debt);
  }

  async getOverdue(companyId: string) {
    return this.prisma.debt.findMany({ where: { companyId, status: 'PENDING', dueDate: { lt: new Date() } }, include: { client: true } });
  }

  async exportExcel(companyId: string) {
    const debts = await this.prisma.debt.findMany({
      where: { companyId },
      include: { client: true },
      orderBy: { createdAt: 'desc' },
    });

    const company = await this.prisma.company.findUnique({ where: { id: companyId } });
    if (!company) throw new NotFoundException('Empresa no encontrada');

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Deudas');

    worksheet.columns = [
      { header: 'Cliente', key: 'client', width: 30 },
      { header: 'Monto', key: 'amount', width: 15 },
      { header: 'Estado', key: 'status', width: 15 },
      { header: 'Vencimiento', key: 'dueDate', width: 20 },
      { header: 'Fecha Creación', key: 'createdAt', width: 20 },
      { header: 'Notas', key: 'notes', width: 40 },
    ];

    debts.forEach((debt) => {
      worksheet.addRow({
        client: `${debt.client.name} ${debt.client.lastName || ''}`,
        amount: debt.amount,
        status: debt.status,
        dueDate: debt.dueDate.toLocaleDateString(),
        createdAt: debt.createdAt.toLocaleDateString(),
        notes: debt.notes || '',
      });
    });

    worksheet.getRow(1).font = { bold: true };

    const buffer = await workbook.xlsx.writeBuffer();
    
    const folder = `patasoft/${company.slug}/exports`;
    const result = await this.uploadToCloudinary(buffer as unknown as Buffer, `deudas_${Date.now()}.xlsx`, folder);

    const document = await this.prisma.document.create({
      data: {
        companyId,
        type: 'EXPORT_EXCEL',
        name: `Exportación Deudas ${new Date().toLocaleDateString()}`,
        cloudinaryUrl: result.url,
        cloudinaryId: result.publicId,
        folder,
        relatedEntity: 'debt',
      },
    });

    this.events.emitToCompany(companyId, 'document:ready', {
      type: 'EXPORT_EXCEL',
      url: result.url,
      documentId: document.id,
    });

    return { url: result.url };
  }

  private async uploadToCloudinary(buffer: Buffer, filename: string, folder: string): Promise<{ url: string; publicId: string }> {
    return new Promise((resolve, reject) => {
      this.cloudinary.getClient().uploader.upload_stream(
        { folder, resource_type: 'raw', public_id: filename },
        (error, result) => {
          if (error) reject(error);
          else resolve({ url: result.secure_url, publicId: result.public_id });
        }
      ).end(buffer);
    });
  }

  async processAlerts() {
    const now = new Date();
    const alert2Days = new Date(now);
    alert2Days.setDate(now.getDate() + 2);
    
    const alert1Day = new Date(now);
    alert1Day.setDate(now.getDate() + 1);

    await this.prisma.debt.updateMany({
      where: {
        status: 'PENDING',
        isDeleted: false,
        dueDate: { lt: now },
      },
      data: { status: 'OVERDUE' },
    });

    const debtsToNotify = await this.prisma.debt.findMany({
      where: {
        status: { in: ['PENDING', 'OVERDUE'] },
        isDeleted: false,
        OR: [
          { dueDate: { lte: alert2Days, gte: now }, alertSent2Day: false },
          { dueDate: { lte: alert1Day, gte: now }, alertSent1Day: false },
          { status: 'OVERDUE' },
        ],
      },
      include: { client: true, company: true },
    });

    for (const debt of debtsToNotify) {
      const isOverdue = debt.status === 'OVERDUE';
      const daysLeft = Math.ceil((debt.dueDate.getTime() - now.getTime()) / (1000 * 3600 * 24));

      let type: any = 'DEBT_DUE';
      let title = 'Recordatorio de pago';
      let message = `La deuda de ${debt.client.name} por $${debt.amount} vence en ${daysLeft} día(s).`;

      if (isOverdue) {
        type = 'DEBT_OVERDUE';
        title = 'Deuda vencida';
        message = `La deuda de ${debt.client.name} por $${debt.amount} está vencida desde el ${debt.dueDate.toLocaleDateString()}.`;
      }

      await this.prisma.notification.create({
        data: {
          companyId: debt.companyId,
          type,
          title,
          message,
          data: { debtId: debt.id, clientId: debt.clientId },
        },
      });

      if (daysLeft <= 1) {
        await this.prisma.debt.update({ where: { id: debt.id }, data: { alertSent1Day: true } });
      } else if (daysLeft <= 2) {
        await this.prisma.debt.update({ where: { id: debt.id }, data: { alertSent2Day: true } });
      }

      this.events.emitToCompany(debt.companyId, 'debt:alert', { title, message, debtId: debt.id });
    }

    return { processed: debtsToNotify.length };
  }
}
