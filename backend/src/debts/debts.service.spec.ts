import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { DebtsService } from './debts.service';

describe('DebtsService', () => {
  let service: DebtsService;
  let mockPrisma: any;
  let mockCloudinary: any;
  let mockEvents: any;
  let mockCashService: any;

  const companyId = 'company-1';

  beforeEach(() => {
    mockPrisma = {
      debt: {
        findMany: vi.fn().mockResolvedValue([]),
        findFirst: vi.fn().mockResolvedValue(null),
        count: vi.fn().mockResolvedValue(0),
        create: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
      },
      payment: {
        update: vi.fn(),
      },
      cashMovement: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
      notification: {
        create: vi.fn(),
      },
      company: {
        findUnique: vi.fn().mockResolvedValue(null),
      },
      $transaction: vi.fn().mockImplementation(async (queries) => {
        return Promise.all(queries);
      }),
    };
    mockCloudinary = {
      getClient: vi.fn().mockReturnValue({
        uploader: { upload_stream: vi.fn() },
      }),
    };
    mockEvents = {
      emitToCompany: vi.fn(),
    };
    mockCashService = {
      createFromPayment: vi.fn().mockResolvedValue({}),
    };
    service = new DebtsService(mockPrisma, mockCloudinary, mockEvents, mockCashService);
  });

  describe('findAll', () => {
    it('should return paginated debts', async () => {
      const debts = [{ id: '1', amount: 5000 }];
      mockPrisma.debt.findMany.mockResolvedValue(debts);
      mockPrisma.debt.count.mockResolvedValue(1);

      const result = await service.findAll(companyId, { page: 1, limit: 10 });

      expect(result.data).toEqual(debts);
      expect(result.meta.total).toBe(1);
    });

    it('should filter by status', async () => {
      mockPrisma.debt.findMany.mockResolvedValue([]);
      mockPrisma.debt.count.mockResolvedValue(0);

      await service.findAll(companyId, { status: 'PENDING' });

      const where = mockPrisma.debt.findMany.mock.calls[0][0].where;
      expect(where.status).toBe('PENDING');
    });
  });

  describe('findOne', () => {
    it('should return debt with client and payment', async () => {
      const debt = { id: '1', amount: 5000, client: {}, payment: {} };
      mockPrisma.debt.findFirst.mockResolvedValue(debt);

      const result = await service.findOne('1', companyId);

      expect(result).toEqual(debt);
    });

    it('should throw NotFoundException if debt not found', async () => {
      mockPrisma.debt.findFirst.mockResolvedValue(null);

      await expect(service.findOne('999', companyId)).rejects.toThrow(NotFoundException);
      await expect(service.findOne('999', companyId)).rejects.toThrow('Deuda no encontrada');
    });
  });

  describe('cancel', () => {
    it('should set status to CANCELLED', async () => {
      const debt = { id: '1', companyId, amount: 5000, client: {}, payment: {} };
      mockPrisma.debt.findFirst.mockResolvedValue(debt);
      mockPrisma.debt.update.mockResolvedValue({ ...debt, status: 'CANCELLED' });

      const result = await service.cancel('1', companyId);

      expect(result.status).toBe('CANCELLED');
      expect(mockPrisma.debt.update).toHaveBeenCalledWith({
        where: { id: '1' },
        data: expect.objectContaining({ status: 'CANCELLED' }),
      });
    });
  });

  describe('markPaid', () => {
    it('should mark debt as PAID for full payment', async () => {
      const debt = { id: '1', companyId, amount: 5000, paymentId: 'pay-1', payment: { paidAmount: 0 }, client: {}, clientId: 'c1' };
      mockPrisma.debt.findFirst.mockResolvedValue(debt);
      mockPrisma.debt.update.mockResolvedValue({});
      mockPrisma.payment.update.mockResolvedValue({});
      mockPrisma.cashMovement.findFirst.mockResolvedValue(null);

      const result = await service.markPaid('1', companyId);

      expect(result.success).toBe(true);
      expect(result.isPartial).toBe(false);
      expect(result.amount).toBe(5000);
      expect(mockPrisma.debt.update).toHaveBeenCalledWith({
        where: { id: '1' },
        data: expect.objectContaining({ status: 'PAID' }),
      });
    });

    it('should handle partial payment', async () => {
      const debt = { id: '1', companyId, amount: 5000, paymentId: 'pay-1', payment: { paidAmount: 0 }, client: {}, clientId: 'c1' };
      mockPrisma.debt.findFirst.mockResolvedValue(debt);
      mockPrisma.debt.update.mockResolvedValue({});
      mockPrisma.payment.update.mockResolvedValue({});

      const result = await service.markPaid('1', companyId, { amount: 2000 });

      expect(result.isPartial).toBe(true);
      expect(result.amount).toBe(2000);
      expect(mockPrisma.debt.update).toHaveBeenCalledWith({
        where: { id: '1' },
        data: expect.objectContaining({ amount: 3000 }),
      });
    });

    it('should create cash movement for full payment without existing movement', async () => {
      const debt = { id: '1', companyId, amount: 5000, paymentId: 'pay-1', payment: { paidAmount: 0 }, client: {}, clientId: 'c1' };
      mockPrisma.debt.findFirst.mockResolvedValue(debt);
      mockPrisma.debt.update.mockResolvedValue({});
      mockPrisma.payment.update.mockResolvedValue({});
      mockPrisma.cashMovement.findFirst.mockResolvedValue(null);

      await service.markPaid('1', companyId);

      expect(mockCashService.createFromPayment).toHaveBeenCalledWith(companyId, 'pay-1', 5000);
    });

    it('should NOT create cash movement if one already exists', async () => {
      const debt = { id: '1', companyId, amount: 5000, paymentId: 'pay-1', payment: { paidAmount: 0 }, client: {}, clientId: 'c1' };
      mockPrisma.debt.findFirst.mockResolvedValue(debt);
      mockPrisma.debt.update.mockResolvedValue({});
      mockPrisma.payment.update.mockResolvedValue({});
      mockPrisma.cashMovement.findFirst.mockResolvedValue({ id: 'existing' });

      await service.markPaid('1', companyId);

      expect(mockCashService.createFromPayment).not.toHaveBeenCalled();
    });

    it('should update payment.paidAmount', async () => {
      const debt = { id: '1', companyId, amount: 5000, paymentId: 'pay-1', payment: { paidAmount: 1000 }, client: {}, clientId: 'c1' };
      mockPrisma.debt.findFirst.mockResolvedValue(debt);
      mockPrisma.debt.update.mockResolvedValue({});
      mockPrisma.payment.update.mockResolvedValue({});
      mockPrisma.cashMovement.findFirst.mockResolvedValue(null);

      await service.markPaid('1', companyId);

      expect(mockPrisma.payment.update).toHaveBeenCalledWith({
        where: { id: 'pay-1' },
        data: expect.objectContaining({ paidAmount: 5000 }),
      });
    });
  });

  describe('calculateDebtAmount', () => {
    it('should return flat amount when no interest rate', () => {
      const debt = { amount: 5000, interestRate: null, originalAmount: null };

      const result = service.calculateDebtAmount(debt);

      expect(result.amount).toBe(5000);
      expect(result.breakdown).toBe('Sin interés');
    });

    it('should calculate interest based on days elapsed', () => {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const debt = {
        amount: 5000,
        originalAmount: 5000,
        interestRate: 10,
        createdAt: thirtyDaysAgo,
      };

      const result = service.calculateDebtAmount(debt);

      expect(result.amount).toBeGreaterThan(5000);
      expect(result.breakdown).toContain('Interés');
    });

    it('should return original amount when 0 days elapsed', () => {
      const debt = {
        amount: 5000,
        originalAmount: 5000,
        interestRate: 10,
        createdAt: new Date(),
      };

      const result = service.calculateDebtAmount(debt);

      expect(result.amount).toBe(5000);
    });
  });

  describe('getOverdue', () => {
    it('should return PENDING debts with dueDate in the past', async () => {
      const overdue = [{ id: '1', status: 'PENDING', dueDate: new Date('2020-01-01') }];
      mockPrisma.debt.findMany.mockResolvedValue(overdue);

      const result = await service.getOverdue(companyId);

      expect(result).toEqual(overdue);
      expect(mockPrisma.debt.findMany).toHaveBeenCalledWith({
        where: {
          companyId,
          status: 'PENDING',
          dueDate: { lt: expect.any(Date) },
        },
        include: { client: true },
      });
    });
  });

  describe('processAlerts', () => {
    it('should mark PENDING debts past dueDate as OVERDUE', async () => {
      mockPrisma.debt.updateMany.mockResolvedValue({ count: 2 });
      mockPrisma.debt.findMany.mockResolvedValue([]);

      await service.processAlerts();

      expect(mockPrisma.debt.updateMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          status: 'PENDING',
          isDeleted: false,
          dueDate: { lt: expect.any(Date) },
        }),
        data: { status: 'OVERDUE' },
      });
    });

    it('should create notifications for debts to notify', async () => {
      const debt = {
        id: 'd1',
        companyId,
        amount: 3000,
        status: 'OVERDUE',
        dueDate: new Date('2020-01-01'),
        client: { name: 'Juan' },
        company: { name: 'Vet' },
        clientId: 'c1',
      };

      mockPrisma.debt.updateMany.mockResolvedValue({ count: 0 });
      mockPrisma.debt.findMany.mockResolvedValue([debt]);
      mockPrisma.notification.create.mockResolvedValue({});
      mockPrisma.debt.update.mockResolvedValue({});

      const result = await service.processAlerts();

      expect(result.processed).toBe(1);
      expect(mockPrisma.notification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          companyId,
          type: 'DEBT_OVERDUE',
        }),
      });
      expect(mockEvents.emitToCompany).toHaveBeenCalledWith(companyId, 'debt:alert', expect.any(Object));
    });

    it('should return 0 processed when no debts to notify', async () => {
      mockPrisma.debt.updateMany.mockResolvedValue({ count: 0 });
      mockPrisma.debt.findMany.mockResolvedValue([]);

      const result = await service.processAlerts();

      expect(result.processed).toBe(0);
    });
  });
});
