import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCashMovementDto, UpdateCashMovementDto, CashSummaryQueryDto } from './dto/cash-movement.dto';
import { CashMovementType } from '@prisma/client';

@Injectable()
export class CashRegisterService {
  private readonly logger = new Logger(CashRegisterService.name);

  constructor(private prisma: PrismaService) {}

  async findAll(companyId: string, q: CashSummaryQueryDto = {}) {
    const { date, startDate, endDate } = q;
    const where: any = { companyId };

    if (date) {
      const d = new Date(date);
      const nextDay = new Date(d);
      nextDay.setDate(d.getDate() + 1);
      where.date = { gte: d, lt: nextDay };
    } else if (startDate || endDate) {
      where.date = {
        ...(startDate && { gte: new Date(startDate) }),
        ...(endDate && { lte: new Date(endDate) }),
      };
    }

    const movements = await this.prisma.cashMovement.findMany({
      where,
      orderBy: { date: 'desc' },
      include: { payment: true },
    });

    return movements;
  }

  async getSummary(companyId: string, q: CashSummaryQueryDto = {}) {
    const { date, startDate, endDate } = q;
    const where: any = { companyId };

    if (date) {
      const d = new Date(date);
      const nextDay = new Date(d);
      nextDay.setDate(d.getDate() + 1);
      where.date = { gte: d, lt: nextDay };
    } else if (startDate || endDate) {
      where.date = {
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

  async create(companyId: string, dto: CreateCashMovementDto, userId?: string) {
    const movement = await this.prisma.cashMovement.create({
      data: {
        companyId,
        type: dto.type,
        amount: dto.amount,
        reason: dto.reason,
        paymentId: dto.paymentId,
        createdBy: userId,
        date: new Date(),
      },
      include: { payment: true },
    });

    this.logger.log(`CashMovement creado: ${movement.id} - ${dto.type} $${dto.amount}`);
    return movement;
  }

  async createFromPayment(companyId: string, paymentId: string, amount: number) {
    return this.create(companyId, {
      type: CashMovementType.INCOME,
      amount,
      reason: `Pago recibido`,
      paymentId,
    });
  }

  async update(companyId: string, id: string, dto: UpdateCashMovementDto) {
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

  async remove(companyId: string, id: string) {
    const movement = await this.prisma.cashMovement.findFirst({ where: { id, companyId } });
    if (!movement) throw new NotFoundException('Movimiento no encontrado');
    if (movement.paymentId) throw new BadRequestException('No se puede eliminar un movimiento vinculado a un pago');
    return this.prisma.cashMovement.delete({ where: { id } });
  }
}
