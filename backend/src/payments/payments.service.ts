import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePaymentDto, UpdatePaymentDto } from './dto/payment.dto';
import { PaymentStatus, PaymentMethod } from '@prisma/client';
import { MercadopagoService } from '../mercadopago/mercadopago.service';
import { PdfService } from '../documents/pdf.service';
import { CashRegisterService } from '../cash-register/cash-register.service';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private prisma: PrismaService,
    private mpService: MercadopagoService,
    private pdfService: PdfService,
    private cashService: CashRegisterService,
  ) {}

  async findAll(companyId: string, q: any = {}) {
    const { page = 1, limit = 20, status, clientId } = q;
    const skip = (Number(page) - 1) * Number(limit);
    const where: any = { 
      companyId, 
      ...(status && { status: status as PaymentStatus }), 
      ...(clientId && { clientId }) 
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.payment.findMany({ 
        where, 
        skip, 
        take: Number(limit), 
        orderBy: { createdAt: 'desc' }, 
        include: { client: true, pet: true, items: true } 
      }),
      this.prisma.payment.count({ where }),
    ]);
    return { 
      data, 
      meta: { 
        total, 
        page: Number(page), 
        limit: Number(limit), 
        totalPages: Math.ceil(total / Number(limit)) 
      } 
    };
  }

  async findOne(id: string, companyId: string) {
    const p = await this.prisma.payment.findFirst({ 
      where: { id, companyId }, 
      include: { client: true, pet: true, items: true, debt: true } 
    });
    if (!p) throw new NotFoundException('Pago no encontrado');
    return p;
  }

  async create(companyId: string, dto: CreatePaymentDto) {
    const items = dto.items?.map(i => ({ 
      description: i.description, 
      quantity: i.quantity, 
      unitPrice: i.unitPrice, 
      totalPrice: i.totalPrice, 
      itemType: i.itemType 
    })) || [];

    const payment = await this.prisma.payment.create({
      data: {
        companyId, 
        clientId: dto.clientId, 
        petId: dto.petId, 
        medicalRecordId: dto.medicalRecordId,
        totalAmount: dto.totalAmount, 
        status: (dto.status as PaymentStatus) || 'PENDING', 
        method: (dto.method as PaymentMethod),
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined, 
        notes: dto.notes,
        items: { create: items },
      },
      include: { items: true },
    });
    this.logger.log(`Pago creado: ${payment.id}`);

    if (dto.method === 'CASH' && payment.status !== 'CANCELLED') {
      await this.cashService.createFromPayment(companyId, payment.id, payment.totalAmount);
    }

    if (dto.clientId && dto.dueDate) {
      const isDeferred = payment.status === 'DEFERRED';
      const isUnconfirmedMethod = ['MP_QR', 'MP_CHECKOUT', 'TRANSFER', 'CHECK'].includes(dto.method);
      
      if (isDeferred || isUnconfirmedMethod) {
        await this.prisma.debt.create({
          data: {
            companyId,
            clientId: dto.clientId,
            paymentId: payment.id,
            amount: payment.totalAmount,
            dueDate: new Date(dto.dueDate),
            notes: dto.notes,
            interestRate: dto.interestRate || null,
            originalAmount: payment.totalAmount,
          }
        });
        this.logger.log(`Deuda creada automáticamente para pago: ${payment.id}`);
      }
    }

    return payment;
  }

  async update(id: string, companyId: string, dto: UpdatePaymentDto) {
    const payment = await this.findOne(id, companyId);
    const updated = await this.prisma.payment.update({ 
      where: { id }, 
      data: { 
        status: dto.status as PaymentStatus, 
        paidAmount: dto.paidAmount, 
        paidAt: dto.paidAt ? new Date(dto.paidAt) : undefined 
      }, 
      include: { items: true, debt: true } 
    });

    // Si se marca como PAID, crear movimiento de caja y saldar deuda
    if (dto.status === 'PAID') {
      const existingMovement = await this.prisma.cashMovement.findFirst({
        where: { paymentId: id }
      });
      if (!existingMovement) {
        await this.cashService.createFromPayment(companyId, id, updated.paidAmount || updated.totalAmount);
      }
      if (updated.debt) {
        await this.prisma.debt.update({
          where: { id: updated.debt.id },
          data: { status: 'PAID', paidAt: new Date() }
        });
      }
    }
    return updated;
  }

  async remove(id: string, companyId: string) {
    await this.findOne(id, companyId);
    await this.prisma.payment.update({
      where: { id },
      data: { isDeleted: true, deletedAt: new Date() } as any,
    });
    this.logger.log(`Pago eliminado (soft): ${id}`);
  }

  async generateCheckoutLink(id: string, companyId: string) {
    await this.findOne(id, companyId);
    return this.mpService.createPreference(companyId, { paymentId: id });
  }

  async generateReceipt(id: string, companyId: string) {
    return this.pdfService.generateReceipt(id, companyId);
  }

  async handleWebhook(query: any) {
    const { topic, id } = query;
    if (topic && id) {
      return this.mpService.handleWebhook(topic, id);
    }
    return { received: true };
  }
}
