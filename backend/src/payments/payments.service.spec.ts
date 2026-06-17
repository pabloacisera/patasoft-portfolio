import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { PaymentsService } from './payments.service';

describe('PaymentsService', () => {
  let service: PaymentsService;
  let mockPrisma: any;
  let mockMpService: any;
  let mockPdfService: any;
  let mockCashService: any;
  let mockDocumentProcessor: any;
  let mockSuppliesService: any;

  const companyId = 'company-1';

  beforeEach(() => {
    mockPrisma = {
      payment: {
        findMany: vi.fn().mockResolvedValue([]),
        findFirst: vi.fn().mockResolvedValue(null),
        count: vi.fn().mockResolvedValue(0),
        create: vi.fn(),
        update: vi.fn(),
      },
      supply: {
        findUnique: vi.fn().mockResolvedValue(null),
        update: vi.fn(),
      },
      debt: {
        create: vi.fn(),
        findFirst: vi.fn().mockResolvedValue(null),
        update: vi.fn(),
      },
      cashMovement: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
      companyConfig: {
        findUnique: vi.fn().mockResolvedValue(null),
      },
      $transaction: vi.fn().mockImplementation(async (queriesOrFn) => {
        if (typeof queriesOrFn === 'function') {
          const tx = {
            payment: mockPrisma.payment,
            supply: mockPrisma.supply,
            debt: mockPrisma.debt,
            cashMovement: mockPrisma.cashMovement,
            companyConfig: mockPrisma.companyConfig,
          };
          return queriesOrFn(tx);
        }
        return Promise.all(queriesOrFn);
      }),
    };
    mockMpService = {
      createPreference: vi.fn().mockResolvedValue({ initPoint: 'https://mp.com/checkout' }),
      handleWebhook: vi.fn().mockResolvedValue({ received: true }),
    };
    mockPdfService = {
      generateAndStoreReceipt: vi.fn().mockResolvedValue({}),
      generateReceipt: vi.fn().mockResolvedValue({ url: 'https://pdf.com' }),
    };
    mockCashService = {
      createFromPayment: vi.fn().mockResolvedValue({}),
    };
    mockDocumentProcessor = {
      enqueuePdfJob: vi.fn().mockResolvedValue('job-id'),
    };
    mockSuppliesService = {
      deductStock: vi.fn().mockResolvedValue(undefined),
    };
    service = new PaymentsService(mockPrisma, mockMpService, mockPdfService, mockCashService, mockDocumentProcessor, mockSuppliesService);
  });

  describe('findAll', () => {
    it('should return paginated payments', async () => {
      const payments = [{ id: '1', totalAmount: 5000 }];
      mockPrisma.payment.findMany.mockResolvedValue(payments);
      mockPrisma.payment.count.mockResolvedValue(1);

      const result = await service.findAll(companyId, { page: 1, limit: 10 });

      expect(result.data).toEqual(payments);
      expect(result.meta.total).toBe(1);
    });

    it('should filter by status', async () => {
      mockPrisma.payment.findMany.mockResolvedValue([]);
      mockPrisma.payment.count.mockResolvedValue(0);

      await service.findAll(companyId, { status: 'PAID' });

      const where = mockPrisma.payment.findMany.mock.calls[0][0].where;
      expect(where.status).toBe('PAID');
    });

    it('should filter by clientId', async () => {
      mockPrisma.payment.findMany.mockResolvedValue([]);
      mockPrisma.payment.count.mockResolvedValue(0);

      await service.findAll(companyId, { clientId: 'client-1' });

      const where = mockPrisma.payment.findMany.mock.calls[0][0].where;
      expect(where.clientId).toBe('client-1');
    });

    it('should always filter out deleted payments', async () => {
      mockPrisma.payment.findMany.mockResolvedValue([]);
      mockPrisma.payment.count.mockResolvedValue(0);

      await service.findAll(companyId);

      const where = mockPrisma.payment.findMany.mock.calls[0][0].where;
      expect(where.isDeleted).toBe(false);
    });
  });

  describe('findOne', () => {
    it('should return payment with all relations', async () => {
      const payment = { id: '1', companyId, client: {}, pet: {}, items: [], medicalRecord: {}, debt: null };
      mockPrisma.payment.findFirst.mockResolvedValue(payment);

      const result = await service.findOne('1', companyId);

      expect(result).toEqual(payment);
    });

    it('should throw NotFoundException if payment not found', async () => {
      mockPrisma.payment.findFirst.mockResolvedValue(null);

      await expect(service.findOne('999', companyId)).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('should create payment with items', async () => {
      const dto = {
        totalAmount: 5000,
        status: 'PENDING',
        items: [{ description: 'Consulta', quantity: 1, unitPrice: 5000, totalPrice: 5000 }],
      };
      const payment = { id: 'pay-1', totalAmount: 5000, items: [], status: 'PENDING' };
      mockPrisma.payment.create.mockResolvedValue(payment);

      const result = await service.create(companyId, dto);

      expect(result).toEqual(payment);
      expect(mockPrisma.payment.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          companyId,
          totalAmount: 5000,
          status: 'PENDING',
          items: { create: expect.any(Array) },
        }),
        include: { items: true },
      });
    });

    it('should discount stock for items with supplyId', async () => {
      const dto = {
        totalAmount: 1000,
        items: [{ description: 'Med', supplyId: 'sup-1', quantity: 3 }],
      };
      mockPrisma.payment.create.mockResolvedValue({ id: 'pay-1', totalAmount: 1000, items: [], status: 'PENDING' });
      mockPrisma.supply.findUnique.mockResolvedValue({ id: 'sup-1', name: 'Med', unitsPerStock: 1 });

      await service.create(companyId, dto);

      expect(mockSuppliesService.deductStock).toHaveBeenCalledWith(companyId, 'sup-1', 3, expect.any(Object));
    });

    it('should create cash movement for CASH payment', async () => {
      const dto = { totalAmount: 3000, method: 'CASH', status: 'PAID' };
      mockPrisma.payment.create.mockResolvedValue({ id: 'pay-1', totalAmount: 3000, items: [], status: 'PAID' });

      await service.create(companyId, dto);

      expect(mockCashService.createFromPayment).toHaveBeenCalledWith(companyId, 'pay-1', 3000);
    });

    it('should NOT create cash movement for CANCELLED payment', async () => {
      const dto = { totalAmount: 3000, method: 'CASH', status: 'CANCELLED' };
      mockPrisma.payment.create.mockResolvedValue({ id: 'pay-1', totalAmount: 3000, items: [], status: 'CANCELLED' });

      await service.create(companyId, dto);

      expect(mockCashService.createFromPayment).not.toHaveBeenCalled();
    });

    it('should create payment without items', async () => {
      const dto = { totalAmount: 2500, status: 'PAID', method: 'CASH' };
      const payment = { id: 'pay-1', totalAmount: 2500, items: [], status: 'PAID', cloudinaryUrl: null };
      mockPrisma.payment.create.mockResolvedValue(payment);

      await service.create(companyId, dto);

      expect(mockPrisma.payment.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          companyId,
          totalAmount: 2500,
          status: 'PAID',
          method: 'CASH',
        }),
        include: { items: true },
      });
    });

    it('should NOT create debt for MP method without dueDate', async () => {
      const dto = { clientId: 'client-1', totalAmount: 5000, method: 'MP_CHECKOUT', status: 'PENDING' };
      mockPrisma.payment.create.mockResolvedValue({ id: 'pay-1', totalAmount: 5000, items: [], status: 'PENDING' });

      await service.create(companyId, dto);

      expect(mockPrisma.debt.create).not.toHaveBeenCalled();
    });

    it('should create debt automatically for DEFERRED payment with dueDate', async () => {
      const dto = {
        clientId: 'client-1',
        totalAmount: 5000,
        status: 'DEFERRED',
        dueDate: '2026-06-15',
      };
      mockPrisma.payment.create.mockResolvedValue({ id: 'pay-1', totalAmount: 5000, items: [], status: 'DEFERRED' });

      await service.create(companyId, dto);

      expect(mockPrisma.debt.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          companyId,
          clientId: 'client-1',
          paymentId: 'pay-1',
          amount: 5000,
          originalAmount: 5000,
        }),
      });
    });

    it('should generate receipt PDF if status is PAID', async () => {
      const dto = { totalAmount: 5000, status: 'PAID' };
      mockPrisma.payment.create.mockResolvedValue({ id: 'pay-1', totalAmount: 5000, items: [], status: 'PAID', cloudinaryUrl: null });

      await service.create(companyId, dto);

      expect(mockDocumentProcessor.enqueuePdfJob).toHaveBeenCalledWith({ companyId, pdfType: 'receipt', paymentId: 'pay-1' });
    });
  });

  describe('update', () => {
    it('should update payment status', async () => {
      const existing = { id: '1', companyId, method: 'CASH', client: {}, pet: {}, items: [], medicalRecord: null, debt: null };
      mockPrisma.payment.findFirst.mockResolvedValue(existing);
      mockPrisma.payment.update.mockResolvedValue({ ...existing, status: 'PAID' });

      const result = await service.update('1', companyId, { status: 'PAID' });

      expect(result.status).toBe('PAID');
    });

    it('should throw BadRequestException when confirming electronic payment without MP config', async () => {
      const existing = { id: '1', companyId, method: 'MP_CHECKOUT', client: {}, pet: {}, items: [], medicalRecord: null, debt: null };
      mockPrisma.payment.findFirst.mockResolvedValue(existing);
      mockPrisma.companyConfig.findUnique.mockResolvedValue({ mpAccessToken: null });

      await expect(service.update('1', companyId, { status: 'PAID' }))
        .rejects.toThrow(BadRequestException);
    });

    it('should create cash movement when marking CASH payment as PAID', async () => {
      const existing = { id: '1', companyId, method: 'CASH', clientId: null, totalAmount: 5000, client: {}, pet: {}, items: [], medicalRecord: null, debt: null };
      mockPrisma.payment.findFirst.mockResolvedValue(existing);
      mockPrisma.payment.update.mockResolvedValue({ ...existing, status: 'PAID', paidAmount: 5000, cloudinaryUrl: null });
      mockPrisma.cashMovement.findFirst.mockResolvedValue(null);

      await service.update('1', companyId, { status: 'PAID' });

      expect(mockCashService.createFromPayment).toHaveBeenCalledWith(companyId, '1', 5000);
    });

    it('should NOT create duplicate cash movement when one already exists', async () => {
      const existing = { id: '1', companyId, method: 'CASH', clientId: null, totalAmount: 5000, client: {}, pet: {}, items: [], medicalRecord: null, debt: null };
      mockPrisma.payment.findFirst.mockResolvedValue(existing);
      mockPrisma.payment.update.mockResolvedValue({ ...existing, status: 'PAID', paidAmount: 5000, cloudinaryUrl: null });
      mockPrisma.cashMovement.findFirst.mockResolvedValue({ id: 'existing-movement' });

      await service.update('1', companyId, { status: 'PAID' });

      expect(mockCashService.createFromPayment).not.toHaveBeenCalled();
    });

    it('should mark debt as PAID when payment is confirmed', async () => {
      const existing = { id: '1', companyId, method: 'CASH', totalAmount: 5000, client: {}, pet: {}, items: [], medicalRecord: null, debt: { id: 'debt-1' } };
      mockPrisma.payment.findFirst.mockResolvedValue(existing);
      mockPrisma.payment.update.mockResolvedValue({ ...existing, status: 'PAID', cloudinaryUrl: null, debt: { id: 'debt-1' } });
      mockPrisma.cashMovement.findFirst.mockResolvedValue(null);

      await service.update('1', companyId, { status: 'PAID' });

      expect(mockPrisma.debt.update).toHaveBeenCalledWith({
        where: { id: 'debt-1' },
        data: expect.objectContaining({ status: 'PAID' }),
      });
    });

    it('should generate receipt when marking payment as PAID', async () => {
      const existing = { id: '1', companyId, method: 'CASH', totalAmount: 5000, client: {}, pet: {}, items: [], medicalRecord: null, debt: null };
      mockPrisma.payment.findFirst.mockResolvedValue(existing);
      mockPrisma.payment.update.mockResolvedValue({ ...existing, status: 'PAID', paidAmount: 5000, cloudinaryUrl: null });
      mockPrisma.cashMovement.findFirst.mockResolvedValue(null);

      await service.update('1', companyId, { status: 'PAID' });

      expect(mockDocumentProcessor.enqueuePdfJob).toHaveBeenCalledWith({ companyId, pdfType: 'receipt', paymentId: '1' });
    });

    it('should NOT generate receipt if cloudinaryUrl already exists', async () => {
      const existing = { id: '1', companyId, method: 'CASH', totalAmount: 5000, client: {}, pet: {}, items: [], medicalRecord: null, debt: null };
      mockPrisma.payment.findFirst.mockResolvedValue(existing);
      mockPrisma.payment.update.mockResolvedValue({ ...existing, status: 'PAID', paidAmount: 5000, cloudinaryUrl: 'https://res.cloudinary.com/xxx.pdf' });

      await service.update('1', companyId, { status: 'PAID' });

      expect(mockDocumentProcessor.enqueuePdfJob).not.toHaveBeenCalled();
    });

    it('should create debt when status changes to DEFERRED with dueDate', async () => {
      const existing = { id: '1', companyId, method: 'TRANSFER', clientId: 'client-1', totalAmount: 3000, client: {}, pet: {}, items: [], medicalRecord: null, debt: null };
      mockPrisma.payment.findFirst.mockResolvedValue(existing);
      mockPrisma.payment.update.mockResolvedValue({ ...existing, status: 'DEFERRED' });
      mockPrisma.debt.findFirst.mockResolvedValue(null);

      await service.update('1', companyId, { status: 'DEFERRED', dueDate: '2026-07-01' });

      expect(mockPrisma.debt.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          paymentId: '1',
          amount: 3000,
        }),
      });
    });

    it('should NOT create debt when marking DEFERRED without clientId', async () => {
      const existing = { id: '1', companyId, method: 'TRANSFER', clientId: null, totalAmount: 3000, client: {}, pet: {}, items: [], medicalRecord: null, debt: null };
      mockPrisma.payment.findFirst.mockResolvedValue(existing);
      mockPrisma.payment.update.mockResolvedValue({ ...existing, status: 'DEFERRED' });

      await service.update('1', companyId, { status: 'DEFERRED', dueDate: '2026-07-01' });

      expect(mockPrisma.debt.create).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException if payment not found', async () => {
      mockPrisma.payment.findFirst.mockResolvedValue(null);

      await expect(service.update('999', companyId, { status: 'PAID' }))
        .rejects.toThrow(NotFoundException);
    });
  });

  describe('generateCheckoutLink', () => {
    it('should delegate to mpService.createPreference', async () => {
      const payment = { id: '1', companyId, client: {}, pet: {}, items: [], medicalRecord: null, debt: null };
      mockPrisma.payment.findFirst.mockResolvedValue(payment);

      const result = await service.generateCheckoutLink('1', companyId);

      expect(mockMpService.createPreference).toHaveBeenCalledWith(companyId, { paymentId: '1' });
      expect(result).toEqual({ initPoint: 'https://mp.com/checkout' });
    });

    it('should throw NotFoundException if payment not found', async () => {
      mockPrisma.payment.findFirst.mockResolvedValue(null);

      await expect(service.generateCheckoutLink('999', companyId))
        .rejects.toThrow(NotFoundException);
    });
  });

  describe('generateReceipt', () => {
    it('should delegate to pdfService.generateReceipt', async () => {
      const payment = { id: '1', companyId, client: {}, pet: {}, items: [], medicalRecord: null, debt: null };
      mockPrisma.payment.findFirst.mockResolvedValue(payment);

      const result = await service.generateReceipt('1', companyId);

      expect(mockPdfService.generateReceipt).toHaveBeenCalledWith('1', companyId);
    });
  });

  describe('handleWebhook', () => {
    it('should delegate to mpService.handleWebhook when topic and id are present', async () => {
      const result = await service.handleWebhook({ topic: 'payment', id: 'mp-123' });

      expect(mockMpService.handleWebhook).toHaveBeenCalledWith('payment', 'mp-123');
      expect(result).toEqual({ received: true });
    });

    it('should return received:true when no topic or id', async () => {
      const result = await service.handleWebhook({});

      expect(mockMpService.handleWebhook).not.toHaveBeenCalled();
      expect(result).toEqual({ received: true });
    });
  });

  describe('remove', () => {
    it('should soft delete payment', async () => {
      const payment = { id: '1', companyId, client: {}, pet: {}, items: [], medicalRecord: null, debt: null };
      mockPrisma.payment.findFirst.mockResolvedValue(payment);
      mockPrisma.payment.update.mockResolvedValue({ ...payment, isDeleted: true });

      await service.remove('1', companyId);

      expect(mockPrisma.payment.update).toHaveBeenCalledWith({
        where: { id: '1' },
        data: expect.objectContaining({ isDeleted: true }),
      });
    });
  });
});
