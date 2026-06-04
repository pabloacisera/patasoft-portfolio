import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { MercadopagoService } from './mercadopago.service';

describe('MercadopagoService', () => {
  let service: MercadopagoService;
  let mockConfig: any;
  let mockPrisma: any;
  let mockPdfService: any;
  let mockCashService: any;
  let mockEventsGateway: any;

  const companyId = 'company-1';
  const paymentId = 'pay-1';

  beforeEach(() => {
    mockConfig = {
      get: vi.fn().mockImplementation((key: string) => {
        const values: Record<string, string> = {
          MP_ACCESS_TOKEN: 'global-mp-token',
          MP_APP_ID: 'app-123',
          MP_CLIENT_SECRET: 'secret-456',
          BACKEND_URL: 'https://api.test.com',
          FRONTEND_URL: 'https://app.test.com',
          MP_REDIRECT_URI: 'https://api.test.com/api/v1/mercadopago/oauth/callback',
        };
        return values[key];
      }),
    };
    mockPrisma = {
      companyConfig: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      payment: {
        findFirst: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      debt: {
        update: vi.fn(),
      },
      cashMovement: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn(),
      },
      $transaction: vi.fn().mockImplementation(async (queries) => Promise.all(queries)),
    };
    mockPdfService = {
      generateAndStoreReceipt: vi.fn().mockResolvedValue({}),
    };
    mockCashService = {
      createFromPayment: vi.fn().mockResolvedValue({}),
    };
    mockEventsGateway = {
      emitToCompany: vi.fn(),
    };

    globalThis.fetch = vi.fn() as any;

    service = new MercadopagoService(
      mockConfig, mockPrisma, mockPdfService, mockCashService, mockEventsGateway,
    );
  });

  describe('createPreference', () => {
    it('should throw BadRequestException if MP not configured for company', async () => {
      mockPrisma.companyConfig.findUnique.mockResolvedValue({ mpAccessToken: null });

      await expect(service.createPreference(companyId, { paymentId }))
        .rejects.toThrow(BadRequestException);
      await expect(service.createPreference(companyId, { paymentId }))
        .rejects.toThrow('MercadoPago no configurado para esta empresa');
    });

    it('should throw NotFoundException if payment not found', async () => {
      mockPrisma.companyConfig.findUnique.mockResolvedValue({ mpAccessToken: 'company-token' });
      mockPrisma.payment.findFirst.mockResolvedValue(null);

      await expect(service.createPreference(companyId, { paymentId }))
        .rejects.toThrow(NotFoundException);
    });

    it('should create preference and return initPoint', async () => {
      const payment = {
        id: paymentId, totalAmount: 5000, companyId,
        items: [], client: { email: 'client@test.com' },
      };
      mockPrisma.companyConfig.findUnique.mockResolvedValue({ mpAccessToken: 'company-token' });
      mockPrisma.payment.findFirst.mockResolvedValue(payment);
      (globalThis.fetch as any).mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ id: 'pref-1', init_point: 'https://mp.com/checkout/1', sandbox_init_point: 'https://sandbox.mp.com/checkout/1' }),
      });
      mockPrisma.payment.update.mockResolvedValue({});

      const result = await service.createPreference(companyId, { paymentId });

      expect(result.initPoint).toBe('https://mp.com/checkout/1');
      expect(mockPrisma.payment.update).toHaveBeenCalledWith({
        where: { id: paymentId },
        data: { method: 'MP_CHECKOUT' },
      });
    });
  });

  describe('handleWebhook', () => {
    it('should update payment to PAID when status is approved', async () => {
      const payment = { id: paymentId, companyId, totalAmount: 5000, debt: { id: 'debt-1' } };
      mockPrisma.payment.findUnique.mockResolvedValue(payment);
      mockPrisma.companyConfig.findUnique.mockResolvedValue({ mpAccessToken: 'company-token' });
      (globalThis.fetch as any).mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          external_reference: paymentId,
          status: 'approved',
        }),
      });

      const result = await service.handleWebhook('payment', 'mp-pay-123');

      expect(result.received).toBe(true);
      expect(mockPrisma.payment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: paymentId },
          data: expect.objectContaining({ status: 'PAID' }),
        }),
      );
      expect(mockPrisma.debt.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'debt-1' },
          data: expect.objectContaining({ status: 'PAID' }),
        }),
      );
    });

    it('should emit payment:confirmed event when payment approved', async () => {
      const payment = { id: paymentId, companyId, totalAmount: 3000, debt: null };
      mockPrisma.payment.findUnique.mockResolvedValue(payment);
      mockPrisma.companyConfig.findUnique.mockResolvedValue({ mpAccessToken: 'company-token' });
      (globalThis.fetch as any).mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          external_reference: paymentId,
          status: 'approved',
        }),
      });

      await service.handleWebhook('payment', 'mp-pay-123');

      expect(mockEventsGateway.emitToCompany).toHaveBeenCalledWith(
        companyId, 'payment:confirmed',
        expect.objectContaining({ paymentId, status: 'PAID' }),
      );
    });

    it('should generate receipt when payment approved', async () => {
      const payment = { id: paymentId, companyId, totalAmount: 3000, debt: null };
      mockPrisma.payment.findUnique.mockResolvedValue(payment);
      mockPrisma.companyConfig.findUnique.mockResolvedValue({ mpAccessToken: 'company-token' });
      (globalThis.fetch as any).mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          external_reference: paymentId,
          status: 'approved',
        }),
      });

      await service.handleWebhook('payment', 'mp-pay-123');

      expect(mockPdfService.generateAndStoreReceipt).toHaveBeenCalledWith(paymentId, companyId);
    });

    it('should update payment to PENDING when status is pending', async () => {
      const payment = { id: paymentId, companyId, totalAmount: 5000, debt: { id: 'debt-1' } };
      mockPrisma.payment.findUnique.mockResolvedValue(payment);
      mockPrisma.companyConfig.findUnique.mockResolvedValue({ mpAccessToken: 'company-token' });
      (globalThis.fetch as any).mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          external_reference: paymentId,
          status: 'pending',
        }),
      });

      await service.handleWebhook('payment', 'mp-pay-123');

      expect(mockPrisma.payment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: paymentId },
          data: expect.objectContaining({ status: 'PENDING' }),
        }),
      );
      expect(mockPrisma.debt.update).not.toHaveBeenCalled();
    });

    it('should not crash when payment is not found in DB', async () => {
      mockPrisma.payment.findUnique.mockResolvedValue(null);
      (globalThis.fetch as any).mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          external_reference: 'unknown-ref',
          status: 'approved',
        }),
      });

      const result = await service.handleWebhook('payment', 'mp-pay-999');
      expect(result.received).toBe(true);
    });

    it('should create cash movement when payment approved and no existing movement', async () => {
      const payment = { id: paymentId, companyId, totalAmount: 5000, debt: null };
      mockPrisma.payment.findUnique.mockResolvedValue(payment);
      mockPrisma.companyConfig.findUnique.mockResolvedValue({ mpAccessToken: 'company-token' });
      (globalThis.fetch as any).mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          external_reference: paymentId,
          status: 'approved',
        }),
      });
      mockPrisma.cashMovement.findFirst.mockResolvedValue(null);

      await service.handleWebhook('payment', 'mp-pay-123');

      expect(mockPrisma.cashMovement.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          companyId, type: 'INCOME', amount: 5000, paymentId,
        }),
      });
    });

    it('should not create duplicate cash movement if one exists', async () => {
      const payment = { id: paymentId, companyId, totalAmount: 5000, debt: null };
      mockPrisma.payment.findUnique.mockResolvedValue(payment);
      mockPrisma.companyConfig.findUnique.mockResolvedValue({ mpAccessToken: 'company-token' });
      (globalThis.fetch as any).mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          external_reference: paymentId,
          status: 'approved',
        }),
      });
      mockPrisma.cashMovement.findFirst.mockResolvedValue({ id: 'existing' });

      await service.handleWebhook('payment', 'mp-pay-123');

      expect(mockPrisma.cashMovement.create).not.toHaveBeenCalled();
    });
  });

  describe('getPaymentStatus', () => {
    it('should throw BadRequestException if MP not configured', async () => {
      mockPrisma.companyConfig.findUnique.mockResolvedValue({ mpAccessToken: null });

      await expect(service.getPaymentStatus('mp-1', companyId))
        .rejects.toThrow(BadRequestException);
    });

    it('should return payment status from MP API', async () => {
      mockPrisma.companyConfig.findUnique.mockResolvedValue({ mpAccessToken: 'company-token' });
      const mpPayment = { id: 'mp-1', status: 'approved' };
      (globalThis.fetch as any).mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue(mpPayment),
      });

      const result = await service.getPaymentStatus('mp-1', companyId);

      expect(result).toEqual(mpPayment);
    });
  });

  describe('disconnectOAuth', () => {
    it('should clear all MP credentials', async () => {
      mockPrisma.companyConfig.update.mockResolvedValue({});

      const result = await service.disconnectOAuth(companyId);

      expect(result.success).toBe(true);
      expect(mockPrisma.companyConfig.update).toHaveBeenCalledWith({
        where: { companyId },
        data: {
          mpAccessToken: null,
          mpRefreshToken: null,
          mpPublicKey: null,
          mpUserId: null,
          mpNickname: null,
        },
      });
    });
  });

  describe('getOAuthStatus', () => {
    it('should return connected: true when mpAccessToken exists', async () => {
      mockPrisma.companyConfig.findUnique.mockResolvedValue({
        mpAccessToken: 'token',
        mpNickname: 'vet-mp',
        mpUserId: '123',
      });

      const result = await service.getOAuthStatus(companyId);

      expect(result.connected).toBe(true);
      expect(result.nickname).toBe('vet-mp');
      expect(result.userId).toBe('123');
    });

    it('should return connected: false when no mpAccessToken', async () => {
      mockPrisma.companyConfig.findUnique.mockResolvedValue({
        mpAccessToken: null,
        mpNickname: null,
        mpUserId: null,
      });

      const result = await service.getOAuthStatus(companyId);

      expect(result.connected).toBe(false);
      expect(result.nickname).toBeNull();
    });
  });
});
