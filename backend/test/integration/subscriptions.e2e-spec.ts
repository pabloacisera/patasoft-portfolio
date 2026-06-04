import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { PrismaService } from '../../src/prisma/prisma.service';
import { RedisService } from '../../src/redis/redis.service';
import { EventsGateway } from '../../src/events/events.gateway';
import { SubscriptionsService } from '../../src/subscriptions/subscriptions.service';
import { SubscriptionsController } from '../../src/subscriptions/subscriptions.controller';
import { JwtModule } from '@nestjs/jwt';
import { JwtAuthGuard } from '../../src/auth/guards/jwt-auth.guard';

// Override env vars before ConfigModule loads
process.env.MP_ACCESS_TOKEN = 'TEST-1234567890-test-token';
process.env.MP_PLAN_MONTHLY_PRICE = '27000';
process.env.MP_PLAN_YEARLY_PRICE = '240000';
process.env.BACKEND_URL = 'https://api.test.com';
process.env.MP_SUCCESS_URL = 'https://test.com/success';
process.env.MP_FAILURE_URL = 'https://test.com/failure';
process.env.MP_PENDING_URL = 'https://test.com/pending';

describe('Subscription Flow E2E', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let currentCompanyId: string;
  let jwtToken: string;

  const mockRedis = {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(undefined),
    del: vi.fn().mockResolvedValue(undefined),
  };

  const mockEventsGateway = {
    emitToCompany: vi.fn(),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
        }),
        JwtModule.register({
          secret: 'test-jwt-secret',
          signOptions: { expiresIn: '1h' },
        }),
      ],
      controllers: [SubscriptionsController],
      providers: [
        SubscriptionsService,
        PrismaService,
        JwtService,
        { provide: RedisService, useValue: mockRedis },
        { provide: EventsGateway, useValue: mockEventsGateway },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context) => {
          const req = context.switchToHttp().getRequest();
          req.user = { id: 'test-user', companyId: currentCompanyId, role: 'USER' };
          return true;
        },
      })
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    prisma = app.get(PrismaService);

    const slug = `e2e-sub-${Date.now()}`;
    const cuit = `${String(Date.now()).slice(0, 11)}`;
    const company = await prisma.company.create({
      data: {
        name: 'E2E Subscription Test',
        slug,
        cuit,
        email: `${slug}@test.com`,
        phone: '1234567890',
        address: 'Test 123',
        isBlocked: false,
      },
    });
    currentCompanyId = company.id;

    const user = await prisma.user.create({
      data: {
        name: 'E2E User',
        email: `e2e-user-${Date.now()}@test.com`,
        passwordHash: 'hashed',
        role: 'USER',
        companyId: currentCompanyId,
      },
    });

    const jwtSvc = app.get(JwtService);
    jwtToken = jwtSvc.sign({ id: user.id, companyId: currentCompanyId, role: 'USER' });

    await prisma.subscription.create({
      data: {
        companyId: currentCompanyId,
        plan: 'TRIAL',
        status: 'ACTIVE',
        trialEndsAt: new Date(Date.now() + 30 * 86400000),
      },
    });
  });

  afterAll(async () => {
    if (prisma) {
      await prisma.subscription.deleteMany({ where: { companyId: currentCompanyId } });
      await prisma.user.deleteMany({ where: { companyId: currentCompanyId } });
      await prisma.company.deleteMany({ where: { id: currentCompanyId } });
      await prisma.$disconnect();
    }
    if (app) await app.close();
  });

  describe('GET /api/v1/subscriptions/status', () => {
    it('should return current subscription status', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/subscriptions/status')
        .set('Authorization', `Bearer ${jwtToken}`)
        .expect(200);

      expect(res.body.plan).toBe('TRIAL');
      expect(res.body.status).toBe('ACTIVE');
      expect(res.body.companyId).toBe(currentCompanyId);
    });
  });

  describe('POST /api/v1/subscriptions/checkout', () => {
    it('should create MP preference and return initPoint', async () => {
      vi.spyOn(globalThis as any, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({
          id: 'pref-e2e-123',
          init_point: 'https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=123',
        }),
      });

      const res = await request(app.getHttpServer())
        .post('/api/v1/subscriptions/checkout')
        .set('Authorization', `Bearer ${jwtToken}`)
        .send({ plan: 'MONTHLY' })
        .expect(201);

      expect(res.body.initPoint).toBeTruthy();
      expect(res.body.initPoint).toContain('mercadopago');

      const fetchCalls = (globalThis.fetch as any).mock.calls;
      const lastCall = fetchCalls[fetchCalls.length - 1];
      expect(lastCall[0]).toBe('https://api.mercadopago.com/checkout/preferences');
      const body = JSON.parse(lastCall[1].body);
      expect(body.items[0].unit_price).toBe(27000);
      expect(body.items[0].title).toContain('Mensual');
      expect(body.external_reference).toContain('subscription');
      expect(body.external_reference).toContain(currentCompanyId);
      expect(lastCall[1].headers.Authorization).toBe('Bearer TEST-1234567890-test-token');
      expect(body.notification_url).toBe('https://api.test.com/api/v1/subscriptions/webhook');
    });

    it('should handle TEST plan with 150 ARS price', async () => {
      vi.spyOn(globalThis as any, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({
          id: 'pref-e2e-test',
          init_point: 'https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=test',
        }),
      });

      const res = await request(app.getHttpServer())
        .post('/api/v1/subscriptions/checkout')
        .set('Authorization', `Bearer ${jwtToken}`)
        .send({ plan: 'TEST' })
        .expect(201);

      expect(res.body.initPoint).toBeTruthy();

      const fetchCalls = (globalThis.fetch as any).mock.calls;
      const lastCall = fetchCalls[fetchCalls.length - 1];
      const body = JSON.parse(lastCall[1].body);
      expect(body.items[0].unit_price).toBe(150);
      expect(body.items[0].title).toContain('TEST 2 días');
    });

    it('should return 400 when MP API fails', async () => {
      vi.spyOn(globalThis as any, 'fetch').mockResolvedValueOnce({
        ok: false,
        text: vi.fn().mockResolvedValue('Invalid credentials'),
      });

      await request(app.getHttpServer())
        .post('/api/v1/subscriptions/checkout')
        .set('Authorization', `Bearer ${jwtToken}`)
        .send({ plan: 'MONTHLY' })
        .expect(400);
    });
  });

  describe('POST /api/v1/subscriptions/webhook - payment approved', () => {
    it('should activate subscription when payment is approved', async () => {
      vi.spyOn(globalThis as any, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({
          id: 'mp-pay-approved-456',
          status: 'approved',
          external_reference: JSON.stringify({
            type: 'subscription',
            companyId: currentCompanyId,
            plan: 'MONTHLY',
          }),
        }),
      });

      const res = await request(app.getHttpServer())
        .post('/api/v1/subscriptions/webhook')
        .send({
          type: 'payment',
          data: { id: 'mp-pay-approved-456' },
        })
        .expect(200);

      expect(res.body.received).toBe(true);

      const subscription = await prisma.subscription.findUnique({
        where: { companyId: currentCompanyId },
      });
      expect(subscription.status).toBe('ACTIVE');
      expect(subscription.plan).toBe('MONTHLY');
      expect(subscription.expiresAt).toBeTruthy();
      expect(subscription.expiresAt.getTime()).toBeGreaterThan(Date.now());

      const company = await prisma.company.findUnique({ where: { id: currentCompanyId } });
      expect(company.isBlocked).toBe(false);
      expect(company.blockedReason).toBeNull();
    });
  });

  describe('POST /api/v1/subscriptions/webhook - payment rejected', () => {
    it('should NOT change subscription when payment is rejected', async () => {
      vi.spyOn(globalThis as any, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({
          id: 'mp-pay-rejected-789',
          status: 'rejected',
          external_reference: JSON.stringify({
            type: 'subscription',
            companyId: currentCompanyId,
            plan: 'TEST',
          }),
        }),
      });

      const res = await request(app.getHttpServer())
        .post('/api/v1/subscriptions/webhook')
        .send({
          type: 'payment',
          data: { id: 'mp-pay-rejected-789' },
        })
        .expect(200);

      expect(res.body.received).toBe(true);

      const subscription = await prisma.subscription.findUnique({
        where: { companyId: currentCompanyId },
      });
      expect(subscription.plan).toBe('MONTHLY');
    });

    it('should handle webhook with non-subscription external_reference', async () => {
      vi.spyOn(globalThis as any, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({
          id: 'mp-pay-other-111',
          status: 'approved',
          external_reference: JSON.stringify({ type: 'payment', paymentId: 'other-pay' }),
        }),
      });

      const res = await request(app.getHttpServer())
        .post('/api/v1/subscriptions/webhook')
        .send({
          type: 'payment',
          data: { id: 'mp-pay-other-111' },
        })
        .expect(200);

      expect(res.body.received).toBe(true);

      const subscription = await prisma.subscription.findUnique({
        where: { companyId: currentCompanyId },
      });
      expect(subscription.plan).toBe('MONTHLY');
    });
  });

  describe('POST /api/v1/subscriptions/cancel', () => {
    it('should cancel the subscription', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/subscriptions/cancel')
        .set('Authorization', `Bearer ${jwtToken}`)
        .expect(201);

      expect(res.body.message).toContain('cancelada');

      const subscription = await prisma.subscription.findUnique({
        where: { companyId: currentCompanyId },
      });
      expect(subscription.status).toBe('CANCELLED');
      expect(subscription.cancelledAt).toBeTruthy();
    });
  });
});
