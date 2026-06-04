import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { SubscriptionsService } from './subscriptions.service';

describe('SubscriptionsService', () => {
  let service: SubscriptionsService;
  let mockConfig: any;
  let mockPrisma: any;
  let mockRedis: any;
  let mockEventsGateway: any;

  const companyId = 'company-1';

  beforeEach(() => {
    mockConfig = {
      get: vi.fn().mockImplementation((key: string) => {
        const values: Record<string, string> = {
          MP_ACCESS_TOKEN: 'test-mp-token',
          MP_PLAN_MONTHLY_PRICE: '2500000',
          MP_PLAN_YEARLY_PRICE: '19000000',
          BACKEND_URL: 'https://api.test.com',
          MP_SUCCESS_URL: 'https://test.com/success',
          MP_FAILURE_URL: 'https://test.com/failure',
          MP_PENDING_URL: 'https://test.com/pending',
        };
        return values[key];
      }),
    };
    mockPrisma = {
      subscription: {
        findUnique: vi.fn().mockResolvedValue(null),
        findMany: vi.fn().mockResolvedValue([]),
        update: vi.fn(),
        upsert: vi.fn(),
      },
      company: {
        findUnique: vi.fn().mockResolvedValue(null),
        update: vi.fn(),
      },
      notification: {
        create: vi.fn(),
      },
      $transaction: vi.fn().mockImplementation(async (queries) => {
        return Promise.all(queries);
      }),
    };
    mockRedis = {
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue(undefined),
      del: vi.fn().mockResolvedValue(undefined),
    };
    mockEventsGateway = {
      emitToCompany: vi.fn(),
    };
    globalThis.fetch = vi.fn() as any;
    service = new SubscriptionsService(mockConfig, mockPrisma, mockRedis, mockEventsGateway);
  });

  describe('getStatus', () => {
    it('should return subscription for company', async () => {
      const sub = { id: '1', companyId, plan: 'TRIAL', status: 'ACTIVE' };
      mockPrisma.subscription.findUnique.mockResolvedValue(sub);

      const result = await service.getStatus(companyId);

      expect(result).toEqual(sub);
    });

    it('should throw NotFoundException if subscription not found', async () => {
      mockPrisma.subscription.findUnique.mockResolvedValue(null);

      await expect(service.getStatus('999')).rejects.toThrow(NotFoundException);
      await expect(service.getStatus('999')).rejects.toThrow('Suscripción no encontrada');
    });
  });

  describe('createCheckout', () => {
    it('should throw BadRequestException if MP not configured', async () => {
      mockConfig.get.mockReturnValue(undefined);

      await expect(service.createCheckout(companyId, { plan: 'MONTHLY' as any }))
        .rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException if company not found', async () => {
      mockPrisma.company.findUnique.mockResolvedValue(null);

      await expect(service.createCheckout('999', { plan: 'MONTHLY' as any }))
        .rejects.toThrow(NotFoundException);
    });
  });

  describe('createCheckout success cases', () => {
    it('should create MP preference for MONTHLY plan and return initPoint', async () => {
      mockPrisma.company.findUnique.mockResolvedValue({ id: companyId, name: 'Vet' });
      (globalThis.fetch as any).mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ init_point: 'https://mp.com/checkout/1' }),
      });

      const result = await service.createCheckout(companyId, { plan: 'MONTHLY' as any });

      expect(result.initPoint).toBe('https://mp.com/checkout/1');
      const fetchCall = (globalThis.fetch as any).mock.calls[0];
      const body = JSON.parse(fetchCall[1].body);
      expect(body.items[0].unit_price).toBe(2500000);
      expect(body.external_reference).toContain('MONTHLY');
    });

    it('should create MP preference for TEST plan with 150 ARS', async () => {
      mockPrisma.company.findUnique.mockResolvedValue({ id: companyId, name: 'Vet' });
      (globalThis.fetch as any).mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ init_point: 'https://mp.com/checkout/test' }),
      });

      const result = await service.createCheckout(companyId, { plan: 'TEST' as any });

      expect(result.initPoint).toBe('https://mp.com/checkout/test');
      const fetchCall = (globalThis.fetch as any).mock.calls[0];
      const body = JSON.parse(fetchCall[1].body);
      expect(body.items[0].unit_price).toBe(150);
      expect(body.items[0].title).toContain('TEST 2 días');
    });

    it('should create MP preference for YEARLY plan', async () => {
      mockPrisma.company.findUnique.mockResolvedValue({ id: companyId, name: 'Vet' });
      (globalThis.fetch as any).mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ init_point: 'https://mp.com/checkout/2' }),
      });

      const result = await service.createCheckout(companyId, { plan: 'YEARLY' as any });

      expect(result.initPoint).toBe('https://mp.com/checkout/2');
      const fetchCall = (globalThis.fetch as any).mock.calls[0];
      const body = JSON.parse(fetchCall[1].body);
      expect(body.items[0].unit_price).toBe(19000000);
      expect(body.items[0].title).toContain('Anual');
    });

    it('should throw BadRequestException when MP API returns error', async () => {
      mockPrisma.company.findUnique.mockResolvedValue({ id: companyId, name: 'Vet' });
      (globalThis.fetch as any).mockResolvedValue({
        ok: false,
        text: vi.fn().mockResolvedValue('Invalid credentials'),
      });

      await expect(service.createCheckout(companyId, { plan: 'MONTHLY' as any }))
        .rejects.toThrow(BadRequestException);
    });
  });

  describe('cancel', () => {
    it('should set status to CANCELLED', async () => {
      mockPrisma.subscription.update.mockResolvedValue({ status: 'CANCELLED' });

      const result = await service.cancel(companyId);

      expect(result.message).toContain('cancelada');
      expect(mockPrisma.subscription.update).toHaveBeenCalledWith({
        where: { companyId },
        data: expect.objectContaining({ status: 'CANCELLED' }),
      });
    });
  });

  describe('handleWebhook', () => {
    it('should call activateSubscription when payment is approved', async () => {
      const sub = { id: 'sub-1', companyId, plan: 'MONTHLY' };
      mockPrisma.company.findUnique.mockResolvedValue({ id: companyId, subscription: sub });
      mockPrisma.subscription.upsert.mockResolvedValue({});
      mockPrisma.company.update.mockResolvedValue({});
      (globalThis.fetch as any).mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          external_reference: JSON.stringify({ type: 'subscription', companyId, plan: 'MONTHLY' }),
          status: 'approved',
        }),
      });

      const result = await service.handleWebhook({ type: 'payment', data: { id: 'mp-pay-1' } });

      expect(result.received).toBe(true);
      expect(mockPrisma.subscription.upsert).toHaveBeenCalled();
      expect(mockPrisma.company.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: companyId },
          data: expect.objectContaining({ isBlocked: false }),
        }),
      );
    });

    it('should NOT call activateSubscription when payment is not approved', async () => {
      (globalThis.fetch as any).mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          external_reference: JSON.stringify({ type: 'subscription', companyId, plan: 'MONTHLY' }),
          status: 'pending',
        }),
      });

      await service.handleWebhook({ type: 'payment', data: { id: 'mp-pay-1' } });

      expect(mockPrisma.subscription.upsert).not.toHaveBeenCalled();
      expect(mockPrisma.company.update).not.toHaveBeenCalled();
    });

    it('should not crash when external_reference is invalid JSON', async () => {
      (globalThis.fetch as any).mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          external_reference: 'not-json',
          status: 'approved',
        }),
      });

      const result = await service.handleWebhook({ type: 'payment', data: { id: 'mp-pay-1' } });

      expect(result.received).toBe(true);
      expect(mockPrisma.subscription.upsert).not.toHaveBeenCalled();
    });

    it('should not do anything when topic is not payment', async () => {
      const result = await service.handleWebhook({ type: 'merchant_order', data: { id: 'ord-1' } });

      expect(result.received).toBe(true);
      expect(globalThis.fetch).not.toHaveBeenCalled();
    });

    it('should not crash when fetch to MP API fails', async () => {
      (globalThis.fetch as any).mockResolvedValue({ ok: false });

      const result = await service.handleWebhook({ type: 'payment', data: { id: 'mp-pay-1' } });

      expect(result.received).toBe(true);
      expect(mockPrisma.subscription.upsert).not.toHaveBeenCalled();
    });
  });

  describe('activateSubscription (private, tested via handleWebhook)', () => {
    it('should set expiresAt to +2 days for TEST plan', async () => {
      mockPrisma.company.findUnique.mockResolvedValue({ id: companyId, subscription: { id: 'sub-1' } });
      mockPrisma.subscription.upsert.mockResolvedValue({});
      mockPrisma.company.update.mockResolvedValue({});
      (globalThis.fetch as any).mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          external_reference: JSON.stringify({ type: 'subscription', companyId, plan: 'TEST' }),
          status: 'approved',
        }),
      });

      await service.handleWebhook({ type: 'payment', data: { id: 'mp-pay-test' } });

      const upsertArgs = mockPrisma.subscription.upsert.mock.calls[0][0];
      const expiresAt = upsertArgs.update.expiresAt;
      const now = new Date();
      const diffMs = expiresAt.getTime() - now.getTime();
      const diffDays = diffMs / 86400000;
      expect(diffDays).toBeGreaterThan(1.5);
      expect(diffDays).toBeLessThan(3);
    });

    it('should set expiresAt to +1 month for MONTHLY plan (approximately)', async () => {
      mockPrisma.company.findUnique.mockResolvedValue({ id: companyId, subscription: { id: 'sub-1' } });
      mockPrisma.subscription.upsert.mockResolvedValue({});
      mockPrisma.company.update.mockResolvedValue({});
      (globalThis.fetch as any).mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          external_reference: JSON.stringify({ type: 'subscription', companyId, plan: 'MONTHLY' }),
          status: 'approved',
        }),
      });

      await service.handleWebhook({ type: 'payment', data: { id: 'mp-pay-monthly' } });

      const upsertArgs = mockPrisma.subscription.upsert.mock.calls[0][0];
      const expiresAt = upsertArgs.update.expiresAt;
      const now = new Date();
      const diffMs = expiresAt.getTime() - now.getTime();
      const diffDays = diffMs / 86400000;
      expect(diffDays).toBeGreaterThan(27);
      expect(diffDays).toBeLessThan(32);
    });

    it('should set expiresAt to +1 year for YEARLY plan (approximately)', async () => {
      mockPrisma.company.findUnique.mockResolvedValue({ id: companyId, subscription: { id: 'sub-1' } });
      mockPrisma.subscription.upsert.mockResolvedValue({});
      mockPrisma.company.update.mockResolvedValue({});
      (globalThis.fetch as any).mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          external_reference: JSON.stringify({ type: 'subscription', companyId, plan: 'YEARLY' }),
          status: 'approved',
        }),
      });

      await service.handleWebhook({ type: 'payment', data: { id: 'mp-pay-yearly' } });

      const upsertArgs = mockPrisma.subscription.upsert.mock.calls[0][0];
      const expiresAt = upsertArgs.update.expiresAt;
      const now = new Date();
      const diffMs = expiresAt.getTime() - now.getTime();
      const diffDays = diffMs / 86400000;
      expect(diffDays).toBeGreaterThan(360);
      expect(diffDays).toBeLessThan(370);
    });

    it('should log error if company not found, not throw', async () => {
      mockPrisma.company.findUnique.mockResolvedValue(null);
      (globalThis.fetch as any).mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          external_reference: JSON.stringify({ type: 'subscription', companyId, plan: 'MONTHLY' }),
          status: 'approved',
        }),
      });

      const result = await service.handleWebhook({ type: 'payment', data: { id: 'mp-pay-1' } });

      expect(result.received).toBe(true);
      expect(mockPrisma.subscription.upsert).not.toHaveBeenCalled();
    });
  });

  describe('checkExpirations', () => {
    it('should expire subscriptions past expiresAt', async () => {
      const expiredSub = {
        id: 'sub-1',
        companyId,
        status: 'ACTIVE',
        expiresAt: new Date('2020-01-01'),
        company: { id: companyId, name: 'Vet' },
      };
      mockPrisma.subscription.findMany.mockResolvedValue([expiredSub]);
      mockPrisma.subscription.update.mockResolvedValue({});
      mockPrisma.company.update.mockResolvedValue({});
      mockPrisma.notification.create.mockResolvedValue({});

      await service.checkExpirations();

      expect(mockPrisma.subscription.update).toHaveBeenCalledWith({
        where: { id: 'sub-1' },
        data: { status: 'EXPIRED' },
      });
    });

    it('should block company when subscription expires', async () => {
      const expiredSub = {
        id: 'sub-1',
        companyId,
        status: 'ACTIVE',
        expiresAt: new Date('2020-01-01'),
        company: { id: companyId },
      };
      mockPrisma.subscription.findMany.mockResolvedValue([expiredSub]);
      mockPrisma.subscription.update.mockResolvedValue({});
      mockPrisma.company.update.mockResolvedValue({});
      mockPrisma.notification.create.mockResolvedValue({});

      await service.checkExpirations();

      expect(mockPrisma.company.update).toHaveBeenCalledWith({
        where: { id: companyId },
        data: expect.objectContaining({ isBlocked: true }),
      });
    });

    it('should create notification when subscription expires', async () => {
      const expiredSub = {
        id: 'sub-1',
        companyId,
        status: 'ACTIVE',
        expiresAt: new Date('2020-01-01'),
        company: { id: companyId },
      };
      mockPrisma.subscription.findMany.mockResolvedValue([expiredSub]);
      mockPrisma.subscription.update.mockResolvedValue({});
      mockPrisma.company.update.mockResolvedValue({});
      mockPrisma.notification.create.mockResolvedValue({});

      await service.checkExpirations();

      expect(mockPrisma.notification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          companyId,
          type: 'SUBSCRIPTION_EXPIRED',
        }),
      });
    });

    it('should emit company:blocked event via WebSocket', async () => {
      const expiredSub = {
        id: 'sub-1',
        companyId,
        status: 'ACTIVE',
        expiresAt: new Date('2020-01-01'),
        company: { id: companyId },
      };
      mockPrisma.subscription.findMany.mockResolvedValue([expiredSub]);
      mockPrisma.subscription.update.mockResolvedValue({});
      mockPrisma.company.update.mockResolvedValue({});
      mockPrisma.notification.create.mockResolvedValue({});

      await service.checkExpirations();

      expect(mockEventsGateway.emitToCompany).toHaveBeenCalledWith(
        companyId,
        'company:blocked',
        expect.objectContaining({ reason: 'Suscripción expirada' }),
      );
    });

    it('should set blockedReason to "Trial expirado" for TRIAL subscriptions', async () => {
      const expiredTrial = {
        id: 'sub-1',
        companyId,
        status: 'TRIAL',
        trialEndsAt: new Date('2020-01-01'),
        company: { id: companyId },
      };
      mockPrisma.subscription.findMany.mockResolvedValue([expiredTrial]);
      mockPrisma.subscription.update.mockResolvedValue({});
      mockPrisma.company.update.mockResolvedValue({});
      mockPrisma.notification.create.mockResolvedValue({});

      await service.checkExpirations();

      expect(mockPrisma.company.update).toHaveBeenCalledWith({
        where: { id: companyId },
        data: expect.objectContaining({ blockedReason: 'Trial expirado' }),
      });
    });

    it('should do nothing when no subscriptions are expired', async () => {
      mockPrisma.subscription.findMany.mockResolvedValue([]);

      await service.checkExpirations();

      expect(mockPrisma.subscription.update).not.toHaveBeenCalled();
      expect(mockPrisma.company.update).not.toHaveBeenCalled();
      expect(mockPrisma.notification.create).not.toHaveBeenCalled();
    });
  });
});
