import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCashMovementDto, UpdateCashMovementDto, CashSummaryQueryDto } from './dto/cash-movement.dto';
import { CashMovementType } from '@prisma/client';

@Injectable()
export class CashRegisterService {
  private readonly logger = new Logger(CashRegisterService.name);

  constructor(private prisma: PrismaService) {}

  async findAll(companyId: number, q: CashSummaryQueryDto = {}) {
    const { date, startDate, endDate, page = 1, limit = 20, search, type } = q;
    const where: any = { companyId };

    if (date) {
      const d = new Date(date);
      const nextDay = new Date(d);
      nextDay.setDate(d.getDate() + 1);
      where.createdAt = { gte: d, lt: nextDay };
    } else if (startDate || endDate) {
      where.createdAt = {
        ...(startDate && { gte: new Date(startDate) }),
        ...(endDate && { lte: new Date(endDate) }),
      };
    }

    if (type) {
      where.type = type;
    }

    if (search) {
      where.reason = { contains: search, mode: 'insensitive' };
    }

    const pageNum = Math.max(1, Number(page) || 1);
    const limitNum = Math.min(100, Math.max(1, Number(limit) || 20));
    const skip = (pageNum - 1) * limitNum;

    const [movements, total] = await Promise.all([
      this.prisma.cashMovement.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: { payment: true },
        skip,
        take: limitNum,
      }),
      this.prisma.cashMovement.count({ where }),
    ]);

    return {
      data: movements,
      meta: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    };
  }

  async getSummary(companyId: number, q: CashSummaryQueryDto = {}) {
    const { date, startDate, endDate } = q;
    const where: any = { companyId };

    if (date) {
      const d = new Date(date);
      const nextDay = new Date(d);
      nextDay.setDate(d.getDate() + 1);
      where.createdAt = { gte: d, lt: nextDay };
    } else if (startDate || endDate) {
      where.createdAt = {
        ...(startDate && { gte: new Date(startDate) }),
        ...(endDate && { lte: new Date(endDate) }),
      };
    }

    const [income, expenses] = await Promise.all([
      this.prisma.cashMovement.aggregate({
        where: { ...where, type: CashMovementType.INCOME },
        _sum: { amount: true },
      }),
      this.prisma.cashMovement.aggregate({
        where: { ...where, type: CashMovementType.EXPENSE },
        _sum: { amount: true },
      }),
    ]);

    const totalIncome = income._sum.amount || 0;
    const totalExpenses = expenses._sum.amount || 0;

    return {
      income: totalIncome,
      expenses: totalExpenses,
      balance: totalIncome - totalExpenses,
    };
  }

  async create(companyId: number, dto: CreateCashMovementDto, userId?: number) {
    const movement = await this.prisma.cashMovement.create({
      data: {
        companyId,
        type: dto.type,
        amount: dto.amount,
        reason: dto.reason,
        paymentId: dto.paymentId,
        createdBy: userId,
      },
      include: { payment: true },
    });

    this.logger.log(`CashMovement creado: ${movement.id} - ${dto.type} $${dto.amount}`);
    return movement;
  }

  async createFromPayment(companyId: number, paymentId: number, amount: number) {
    return this.create(companyId, {
      type: CashMovementType.INCOME,
      amount,
      reason: `Pago recibido`,
      paymentId,
    });
  }

  async reverseFromPayment(companyId: number, paymentId: number, tx?: any) {
    const prisma = tx || this.prisma;
    const movement = await prisma.cashMovement.findFirst({
      where: { paymentId, companyId }
    });
    if (!movement) return null;

    await prisma.cashMovement.delete({ where: { id: movement.id } });
    this.logger.log(`Movimiento de caja revertido para pago: ${paymentId}`);
    return movement;
  }

  async update(companyId: number, id: number, dto: UpdateCashMovementDto) {
    const movement = await this.prisma.cashMovement.findFirst({ where: { id, companyId } });
    if (!movement) throw new NotFoundException('Movimiento no encontrado');
    if (movement.paymentId) throw new BadRequestException('No se puede editar un movimiento vinculado a un pago');
    return this.prisma.cashMovement.update({
      where: { id },
      data: {
        ...(dto.amount !== undefined && { amount: dto.amount }),
        ...(dto.reason !== undefined && { reason: dto.reason }),
      },
    });
  }

  async remove(companyId: number, id: number) {
    const movement = await this.prisma.cashMovement.findFirst({ where: { id, companyId } });
    if (!movement) throw new NotFoundException('Movimiento no encontrado');
    if (movement.paymentId) throw new BadRequestException('No se puede eliminar un movimiento vinculado a un pago');
    return this.prisma.cashMovement.delete({ where: { id } });
  }
}
