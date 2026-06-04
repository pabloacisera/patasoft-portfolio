import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { ForbiddenException } from '@nestjs/common';

const mockParentCanActivate = vi.fn().mockResolvedValue(true);

vi.mock('@nestjs/passport', () => {
  class MockAuthGuard {
    async canActivate() {
      return mockParentCanActivate();
    }
  }
  return {
    AuthGuard: vi.fn(() => MockAuthGuard),
  };
});

import { JwtAuthGuard } from './jwt-auth.guard';

function createMockContext(opts: {
  user?: any;
  route?: string;
  method?: string;
} = {}): any {
  const request: any = {
    user: opts.user ?? { id: 'user-1', companyId: 'company-1', role: 'USER' },
    path: opts.route ?? '/api/v1/some-route',
    route: { path: opts.route ?? '/api/v1/some-route' },
    method: opts.method ?? 'GET',
  };
  return {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => ({}),
      getNext: () => vi.fn(),
    }),
    getHandler: () => ({} as any),
    getClass: () => ({} as any),
  };
}

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;
  let mockReflector: any;
  let mockPrisma: any;
  let mockRedis: any;

  beforeEach(() => {
    mockReflector = {
      getAllAndOverride: vi.fn().mockReturnValue(undefined),
    };
    mockPrisma = {
      subscription: {
        findUnique: vi.fn(),
      },
    };
    mockRedis = {
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue(undefined),
      del: vi.fn().mockResolvedValue(undefined),
    };

    mockParentCanActivate.mockResolvedValue(true);

    guard = new JwtAuthGuard(mockReflector, mockPrisma, mockRedis);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('@Public() decorator', () => {
    it('should allow request if @Public() is present', async () => {
      mockReflector.getAllAndOverride.mockReturnValue(true);
      const ctx = createMockContext();
      await expect(guard.canActivate(ctx)).resolves.toBe(true);
      expect(mockParentCanActivate).not.toHaveBeenCalled();
    });
  });

  describe('SUPER_ADMIN role', () => {
    it('should allow SUPER_ADMIN without subscription check', async () => {
      const ctx = createMockContext({ user: { id: 'admin-1', role: 'SUPER_ADMIN' } });
      await expect(guard.canActivate(ctx)).resolves.toBe(true);
      expect(mockPrisma.subscription.findUnique).not.toHaveBeenCalled();
    });
  });

  describe('user without companyId', () => {
    it('should block request if no companyId and not on exempt path', async () => {
      const ctx = createMockContext({
        user: { id: 'user-1', role: 'USER' },
        route: '/api/v1/pets',
      });
      await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
    });

    it('should allow POST /api/v1/companies to create company', async () => {
      const ctx = createMockContext({
        user: { id: 'user-1', role: 'USER' },
        route: '/api/v1/companies',
        method: 'POST',
      });
      await expect(guard.canActivate(ctx)).resolves.toBe(true);
    });

    it('should allow /api/v1/companies/me without companyId', async () => {
      const ctx = createMockContext({
        user: { id: 'user-1', role: 'USER' },
        route: '/api/v1/companies/me',
      });
      await expect(guard.canActivate(ctx)).resolves.toBe(true);
    });
  });

  describe('subscription exempt routes', () => {
    const exemptRoutes = [
      '/api/v1/companies/me',
      '/api/v1/subscriptions/status',
      '/api/v1/subscriptions/checkout',
      '/api/v1/auth/me',
      '/api/v1/data/export-all',
    ];

    exemptRoutes.forEach((route) => {
      it(`should allow ${route} even with expired subscription`, async () => {
        const ctx = createMockContext({ route });
        await expect(guard.canActivate(ctx)).resolves.toBe(true);
        expect(mockPrisma.subscription.findUnique).not.toHaveBeenCalled();
      });
    });
  });

  describe('subscription status check', () => {
    it('should allow request when subscription is ACTIVE and not expired', async () => {
      const ctx = createMockContext();
      mockPrisma.subscription.findUnique.mockResolvedValue({
        status: 'ACTIVE',
        expiresAt: new Date(Date.now() + 86400000),
        trialEndsAt: null,
      });
      await expect(guard.canActivate(ctx)).resolves.toBe(true);
    });

    it('should block request when subscription status is BLOCKED', async () => {
      const ctx = createMockContext();
      mockPrisma.subscription.findUnique.mockResolvedValue({
        status: 'BLOCKED',
        expiresAt: null,
        trialEndsAt: null,
      });
      await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
    });

    it('should block request when ACTIVE subscription has expired', async () => {
      const ctx = createMockContext();
      mockPrisma.subscription.findUnique.mockResolvedValue({
        status: 'ACTIVE',
        expiresAt: new Date('2020-01-01'),
        trialEndsAt: null,
      });
      await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
    });

    it('should block request when TRIAL subscription has expired', async () => {
      const ctx = createMockContext();
      mockPrisma.subscription.findUnique.mockResolvedValue({
        status: 'TRIAL',
        expiresAt: null,
        trialEndsAt: new Date('2020-01-01'),
      });
      await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
    });

    it('should allow request when TRIAL is still valid', async () => {
      const ctx = createMockContext();
      mockPrisma.subscription.findUnique.mockResolvedValue({
        status: 'TRIAL',
        expiresAt: null,
        trialEndsAt: new Date(Date.now() + 86400000),
      });
      await expect(guard.canActivate(ctx)).resolves.toBe(true);
    });
  });

  describe('Redis cache', () => {
    it('should use cached subscription status and not query DB', async () => {
      const ctx = createMockContext();
      const cachedSub = JSON.stringify({ status: 'BLOCKED' });
      mockRedis.get.mockResolvedValue(cachedSub);

      await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
      expect(mockPrisma.subscription.findUnique).not.toHaveBeenCalled();
    });

    it('should set cache when subscription is fetched from DB', async () => {
      const ctx = createMockContext();
      const sub = {
        status: 'ACTIVE',
        expiresAt: new Date(Date.now() + 86400000),
        trialEndsAt: null,
      };
      mockPrisma.subscription.findUnique.mockResolvedValue(sub);

      await guard.canActivate(ctx);

      expect(mockRedis.set).toHaveBeenCalledWith(
        'sub_status:company-1',
        JSON.stringify(sub),
        300,
      );
    });
  });
});
