import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { CashRegisterService } from './cash-register.service';
import { CashMovementType } from '@prisma/client';

describe('CashRegisterService', () => {
  let service: CashRegisterService;
  let mockPrisma: any;

  const companyId = 'company-1';
  const movementId = 'movement-1';

  beforeEach(() => {
    mockPrisma = {
      cashMovement: {
        findMany: vi.fn().mockResolvedValue([]),
        findFirst: vi.fn().mockResolvedValue(null),
        count: vi.fn().mockResolvedValue(0),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        aggregate: vi.fn().mockResolvedValue({ _sum: { amount: 0 } }),
      },
    };
    service = new CashRegisterService(mockPrisma);
  });

  describe('findAll', () => {
    it('should return paginated movements', async () => {
      const movements = [{ id: '1', amount: 100, type: CashMovementType.INCOME }];
      mockPrisma.cashMovement.findMany.mockResolvedValue(movements);
      mockPrisma.cashMovement.count.mockResolvedValue(1);

      const result = await service.findAll(companyId, { page: 1, limit: 10 });

      expect(result.data).toEqual(movements);
      expect(result.meta.total).toBe(1);
      expect(result.meta.page).toBe(1);
      expect(result.meta.limit).toBe(10);
    });

    it('should filter by date', async () => {
      await service.findAll(companyId, { date: '2026-05-29' });

      const where = mockPrisma.cashMovement.findMany.mock.calls[0][0].where;
      expect(where.date).toBeDefined();
      expect(where.date.gte).toBeInstanceOf(Date);
      expect(where.date.lt).toBeInstanceOf(Date);
    });

    it('should filter by type', async () => {
      await service.findAll(companyId, { type: CashMovementType.INCOME });

      const where = mockPrisma.cashMovement.findMany.mock.calls[0][0].where;
      expect(where.type).toBe(CashMovementType.INCOME);
    });

    it('should filter by search in reason', async () => {
      await service.findAll(companyId, { search: 'pago' });

      const where = mockPrisma.cashMovement.findMany.mock.calls[0][0].where;
      expect(where.reason).toEqual({ contains: 'pago', mode: 'insensitive' });
    });
  });

  describe('getSummary', () => {
    it('should return income, expenses and balance', async () => {
      mockPrisma.cashMovement.aggregate
        .mockResolvedValueOnce({ _sum: { amount: 5000 } })
        .mockResolvedValueOnce({ _sum: { amount: 2000 } });

      const result = await service.getSummary(companyId);

      expect(result.income).toBe(5000);
      expect(result.expenses).toBe(2000);
      expect(result.balance).toBe(3000);
    });

    it('should return 0 when no movements', async () => {
      const result = await service.getSummary(companyId);

      expect(result.income).toBe(0);
      expect(result.expenses).toBe(0);
      expect(result.balance).toBe(0);
    });
  });

  describe('create', () => {
    it('should create an INCOME movement', async () => {
      const dto = { type: CashMovementType.INCOME, amount: 1000, reason: 'Test' };
      const created = { id: '1', ...dto, companyId, date: new Date() };
      mockPrisma.cashMovement.create.mockResolvedValue(created);

      const result = await service.create(companyId, dto);

      expect(result).toEqual(created);
      expect(mockPrisma.cashMovement.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          companyId,
          type: CashMovementType.INCOME,
          amount: 1000,
          reason: 'Test',
        }),
        include: { payment: true },
      });
    });

    it('should create an EXPENSE movement', async () => {
      const dto = { type: CashMovementType.EXPENSE, amount: 500, reason: 'Gasto' };
      mockPrisma.cashMovement.create.mockResolvedValue({ id: '2', ...dto });

      const result = await service.create(companyId, dto);

      expect(result.type).toBe(CashMovementType.EXPENSE);
    });
  });

  describe('createFromPayment', () => {
    it('should create INCOME movement linked to payment', async () => {
      const paymentId = 'payment-1';
      mockPrisma.cashMovement.create.mockResolvedValue({ id: '1', paymentId });

      await service.createFromPayment(companyId, paymentId, 2500);

      expect(mockPrisma.cashMovement.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: CashMovementType.INCOME,
          amount: 2500,
          paymentId,
          reason: 'Pago recibido',
        }),
        include: { payment: true },
      });
    });
  });

  describe('update', () => {
    it('should update a movement without paymentId', async () => {
      mockPrisma.cashMovement.findFirst.mockResolvedValue({
        id: movementId,
        companyId,
        paymentId: null,
      });
      mockPrisma.cashMovement.update.mockResolvedValue({ id: movementId, amount: 2000 });

      const result = await service.update(companyId, movementId, { amount: 2000 });

      expect(result.amount).toBe(2000);
    });

    it('should throw NotFoundException if movement not found', async () => {
      mockPrisma.cashMovement.findFirst.mockResolvedValue(null);

      await expect(service.update(companyId, 'nonexistent', { amount: 100 }))
        .rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if movement has paymentId', async () => {
      mockPrisma.cashMovement.findFirst.mockResolvedValue({
        id: movementId,
        companyId,
        paymentId: 'payment-1',
      });

      await expect(service.update(companyId, movementId, { amount: 100 }))
        .rejects.toThrow(BadRequestException);
    });
  });

  describe('remove', () => {
    it('should delete a movement without paymentId', async () => {
      mockPrisma.cashMovement.findFirst.mockResolvedValue({
        id: movementId,
        companyId,
        paymentId: null,
      });
      mockPrisma.cashMovement.delete.mockResolvedValue({ id: movementId });

      await service.remove(companyId, movementId);

      expect(mockPrisma.cashMovement.delete).toHaveBeenCalledWith({ where: { id: movementId } });
    });

    it('should throw NotFoundException if movement not found', async () => {
      mockPrisma.cashMovement.findFirst.mockResolvedValue(null);

      await expect(service.remove(companyId, 'nonexistent'))
        .rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if movement has paymentId', async () => {
      mockPrisma.cashMovement.findFirst.mockResolvedValue({
        id: movementId,
        companyId,
        paymentId: 'payment-1',
      });

      await expect(service.remove(companyId, movementId))
        .rejects.toThrow(BadRequestException);
    });
  });
});
