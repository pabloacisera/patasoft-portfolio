import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePaymentDto, UpdatePaymentDto } from './dto/payment.dto';
import { PaymentStatus, PaymentMethod } from '@prisma/client';
import { MercadopagoService } from '../mercadopago/mercadopago.service';
import { PdfService } from '../documents/pdf.service';
import { CashRegisterService } from '../cash-register/cash-register.service';
import { DocumentProcessorService } from '../queues/document-processor.service';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private prisma: PrismaService,
    private mpService: MercadopagoService,
    private pdfService: PdfService,
    private cashService: CashRegisterService,
    private documentProcessor: DocumentProcessorService,
  ) {}

  async findAll(companyId: string, q: any = {}) {
    const { page = 1, limit = 20, status, clientId } = q;
    const skip = (Number(page) - 1) * Number(limit);
    const where: any = { 
      companyId, 
      isDeleted: false,
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
    const payment = await this.prisma.payment.findFirst({
      where: { id, companyId, isDeleted: false },
      include: {
        client: true,
        pet: true,
        items: true,
        medicalRecord: true,
        debt: true,
      },
    });
    if (!payment) throw new NotFoundException('Pago no encontrado');
    return payment;
  }

  async create(companyId: string, dto: CreatePaymentDto) {
    const items = dto.items?.map(i => ({ 
      description: i.description, 
      quantity: i.quantity, 
      unitPrice: i.unitPrice, 
      totalPrice: i.totalPrice, 
      itemType: i.itemType || 'SUPPLY',
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

    // Descontar stock de items con supplyId
    for (const item of dto.items || []) {
      if (!item.supplyId) continue;
      const supply = await this.prisma.supply.findUnique({ where: { id: item.supplyId } });
      if (!supply) continue;
      const qty = item.quantity || 1;
      const stockUnitsUsed = supply.unitsPerStock ? Math.ceil(qty / supply.unitsPerStock) : qty;
      await this.prisma.supply.update({
        where: { id: item.supplyId },
        data: { quantity: { decrement: stockUnitsUsed } },
      });
      this.logger.log(`Stock descontado: ${supply.name} -${stockUnitsUsed}`);
    }

    if (dto.method === 'CASH' && payment.status === 'PAID') {
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

    // Generar comprobante si el pago ya está cobrado
    if (payment.status === 'PAID' && !payment.cloudinaryUrl) {
      this.documentProcessor.enqueuePdfJob({ companyId, pdfType: 'receipt', paymentId: payment.id }).catch(e =>
        this.logger.error('Error encolando PDF comprobante', e)
      );
    }

    return payment;
  }

  async update(id: string, companyId: string, dto: UpdatePaymentDto) {
    const payment = await this.findOne(id, companyId);

    // Validar que no se pueda marcar como PAID un pago electrónico sin MP configurado
    if (dto.status === 'PAID' && ['MP_QR', 'MP_CHECKOUT'].includes(payment.method as string)) {
      const companyConfig = await this.prisma.companyConfig.findUnique({
        where: { companyId },
        select: { mpAccessToken: true },
      });
      if (!companyConfig?.mpAccessToken) {
        throw new BadRequestException(
          'No se puede confirmar el pago: MercadoPago no está configurado para esta empresa. Configurá la cuenta en Ajustes > MercadoPago o cambiá el método de pago.'
        );
      }
    }

    const updated = await this.prisma.payment.update({ 
      where: { id }, 
      data: { 
        ...(dto.status && { status: dto.status as PaymentStatus }),
        ...(dto.method && { method: dto.method as PaymentMethod }),
        ...(dto.paidAmount !== undefined && { paidAmount: dto.paidAmount }),
        ...(dto.paidAt && { paidAt: new Date(dto.paidAt) }),
        ...(dto.dueDate && { dueDate: new Date(dto.dueDate) }),
      }, 
      include: { items: true, debt: true } 
    });

    // Si se marca como PAID, crear movimiento de caja y saldar deuda
    if (dto.status === 'PAID') {
      const existingMovement = await this.prisma.cashMovement.findFirst({
        where: { paymentId: id }
      });
      if (!existingMovement) {
        const paymentMethod = dto.method || payment.method;
        if (paymentMethod === 'CASH') {
          await this.cashService.createFromPayment(companyId, id, updated.paidAmount ?? updated.totalAmount);
        }
      }
      if (updated.debt) {
        await this.prisma.debt.update({
          where: { id: updated.debt.id },
          data: { status: 'PAID', paidAt: new Date() }
        });
      }
      // Generar comprobante PDF si no tiene cloudinaryUrl
      if (!updated.cloudinaryUrl) {
        this.documentProcessor.enqueuePdfJob({ companyId, pdfType: 'receipt', paymentId: id }).catch(e =>
          this.logger.error('Error encolando PDF comprobante', e)
        );
      }
    }

    // Si es DEFERRED y tiene clientId, crear deuda
    if (dto.status === 'DEFERRED' && payment.clientId && dto.dueDate) {
      const existingDebt = await this.prisma.debt.findFirst({ where: { paymentId: id } });
      if (!existingDebt) {
        await this.prisma.debt.create({
          data: {
            companyId,
            clientId: payment.clientId,
            paymentId: id,
            amount: payment.totalAmount,
            dueDate: new Date(dto.dueDate),
            interestRate: dto.interestRate || null,
            originalAmount: payment.totalAmount,
          },
        });
      }
    }

    return updated;
  }

  async remove(id: string, companyId: string) {
    await this.findOne(id, companyId);
    return this.prisma.payment.update({
      where: { id },
      data: { isDeleted: true, deletedAt: new Date() },
    });
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
