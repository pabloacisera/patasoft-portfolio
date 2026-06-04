import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { PrismaService } from '../../src/prisma/prisma.service';
import { PaymentsService } from '../../src/payments/payments.service';
import { PaymentsController } from '../../src/payments/payments.controller';
import { MercadopagoService } from '../../src/mercadopago/mercadopago.service';
import { MercadopagoController } from '../../src/mercadopago/mercadopago.controller';
import { CashRegisterService } from '../../src/cash-register/cash-register.service';
import { PdfService } from '../../src/documents/pdf.service';
import { EventsGateway } from '../../src/events/events.gateway';
import { JwtModule } from '@nestjs/jwt';
import { JwtAuthGuard } from '../../src/auth/guards/jwt-auth.guard';

process.env.MP_ACCESS_TOKEN = 'TEST-1234567890-test-token';
process.env.BACKEND_URL = 'https://api.test.com';
process.env.FRONTEND_URL = 'https://test.com';
process.env.JWT_SECRET = 'test-jwt-secret';

describe('Client Payment Flow E2E', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let currentCompanyId: string;
  let jwtToken: string;
  let clientId: string;
  let cashPaymentId: string;
  let checkoutPaymentId: string;
  let qrPaymentId: string;
  let transferPaymentId: string;
  let checkPaymentId: string;

  const mockPdfService = {
    generateReceipt: vi.fn().mockResolvedValue(Buffer.from('fake-pdf-content')),
    generateAndStoreReceipt: vi.fn().mockResolvedValue(undefined),
    generatePetCard: vi.fn().mockResolvedValue(Buffer.from('fake-pdf')),
    generateMedicalHistory: vi.fn().mockResolvedValue(Buffer.from('fake-pdf')),
    generateAndStorePrescription: vi.fn().mockResolvedValue(Buffer.from('fake-pdf')),
  };

  const mockEventsGateway = {
    emitToCompany: vi.fn(),
    emitToUser: vi.fn(),
    server: { to: vi.fn().mockReturnThis(), emit: vi.fn() },
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
      controllers: [PaymentsController, MercadopagoController],
      providers: [
        PaymentsService,
        MercadopagoService,
        CashRegisterService,
        PrismaService,
        { provide: PdfService, useValue: mockPdfService },
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

    const slug = `e2e-pay-${Date.now()}`;
    const cuit = `${String(Date.now()).slice(0, 11)}`;
    const company = await prisma.company.create({
      data: {
        name: 'E2E Payment Test',
        slug,
        cuit,
        email: `${slug}@test.com`,
        phone: '1234567890',
        address: 'Test 123',
        isBlocked: false,
      },
    });
    currentCompanyId = company.id;

    await prisma.companyConfig.create({
      data: {
        companyId: currentCompanyId,
        mpAccessToken: 'TEST-company-specific-token-999',
        mpUserId: '123456789',
        mpPublicKey: 'TEST-public-key',
      },
    });

    const cli = await prisma.client.create({
      data: {
        companyId: currentCompanyId,
        name: 'E2E Client',
        email: `e2e-client-${Date.now()}@test.com`,
        phone: '0987654321',
      },
    });
    clientId = cli.id;

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
  });

  afterAll(async () => {
    if (prisma) {
      await prisma.cashMovement.deleteMany({ where: { companyId: currentCompanyId } });
      await prisma.debt.deleteMany({ where: { companyId: currentCompanyId } });
      await prisma.paymentItem.deleteMany({ where: { payment: { companyId: currentCompanyId } } });
      await prisma.payment.deleteMany({ where: { companyId: currentCompanyId } });
      await prisma.client.deleteMany({ where: { companyId: currentCompanyId } });
      await prisma.user.deleteMany({ where: { companyId: currentCompanyId } });
      await prisma.companyConfig.deleteMany({ where: { companyId: currentCompanyId } });
      await prisma.company.deleteMany({ where: { id: currentCompanyId } });
      await prisma.$disconnect();
    }
    if (app) await app.close();
  });

  describe('CASH payment flow', () => {
    it('should create a CASH payment with PAID status and generate cash movement', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/payments')
        .set('Authorization', `Bearer ${jwtToken}`)
        .send({
          clientId,
          totalAmount: 5000,
          method: 'CASH',
          status: 'PAID',
          items: [
            { description: 'Consulta', quantity: 1, unitPrice: 3000, totalPrice: 3000, itemType: 'CONSULTATION' },
            { description: 'Medicación', quantity: 2, unitPrice: 1000, totalPrice: 2000, itemType: 'SUPPLY' },
          ],
        })
        .expect(201);

      expect(res.body.id).toBeTruthy();
      expect(res.body.status).toBe('PAID');
      expect(res.body.method).toBe('CASH');
      expect(res.body.totalAmount).toBe(5000);
      expect(res.body.companyId).toBe(currentCompanyId);
      expect(res.body.items).toHaveLength(2);

      cashPaymentId = res.body.id;

      const cashMovement = await prisma.cashMovement.findFirst({
        where: { paymentId: cashPaymentId },
      });
      expect(cashMovement).toBeTruthy();
      expect(cashMovement.type).toBe('INCOME');
      expect(cashMovement.amount).toBe(5000);
    });

    it('should generate receipt PDF for CASH payment via generateReceipt', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/payments/${cashPaymentId}/receipt`)
        .set('Authorization', `Bearer ${jwtToken}`)
        .expect(200);

      expect(res.headers['content-type']).toBe('application/pdf');
      expect(res.body).toBeInstanceOf(Buffer);
      expect(res.body.length).toBeGreaterThan(0);
      expect(mockPdfService.generateReceipt).toHaveBeenCalledWith(cashPaymentId, currentCompanyId);
    });
  });

  describe('MP_CHECKOUT flow (via PaymentsController)', () => {
    it('should create a PENDING MP_CHECKOUT payment', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/payments')
        .set('Authorization', `Bearer ${jwtToken}`)
        .send({
          clientId,
          totalAmount: 15000,
          method: 'MP_CHECKOUT',
          status: 'PENDING',
          items: [
            { description: 'Cirugía', quantity: 1, unitPrice: 15000, totalPrice: 15000, itemType: 'PROCEDURE' },
          ],
        })
        .expect(201);

      expect(res.body.id).toBeTruthy();
      expect(res.body.status).toBe('PENDING');
      expect(res.body.method).toBe('MP_CHECKOUT');
      expect(res.body.totalAmount).toBe(15000);

      checkoutPaymentId = res.body.id;
    });

    it('should create MP preference and return init point', async () => {
      vi.spyOn(globalThis as any, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({
          id: 'pref-e2e-checkout-456',
          init_point: 'https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=456',
          sandbox_init_point: 'https://sandbox.mercadopago.com.ar/checkout/v1/redirect?pref_id=456',
        }),
      });

      const res = await request(app.getHttpServer())
        .post(`/api/v1/payments/${checkoutPaymentId}/checkout`)
        .set('Authorization', `Bearer ${jwtToken}`)
        .expect(201);

      expect(res.body.initPoint).toBeTruthy();
      expect(res.body.initPoint).toContain('mercadopago');
      expect(res.body.preferenceId).toBe('pref-e2e-checkout-456');

      const fetchCalls = (globalThis.fetch as any).mock.calls;
      const lastCall = fetchCalls[fetchCalls.length - 1];
      const callUrl = lastCall[0];
      expect(callUrl).toBe('https://api.mercadopago.com/checkout/preferences');

      const body = JSON.parse(lastCall[1].body);
      expect(body.items[0].unit_price).toBe(15000);
      expect(body.external_reference).toBe(checkoutPaymentId);
      expect(lastCall[1].headers.Authorization).toBe('Bearer TEST-company-specific-token-999');
    });

    it('should confirm payment via webhook and update DB', async () => {
      const mpPaymentId = 'mp-pay-approved-888';

      vi.spyOn(globalThis as any, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({
          id: mpPaymentId,
          status: 'approved',
          external_reference: checkoutPaymentId,
        }),
      });

      vi.spyOn(globalThis as any, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({
          id: mpPaymentId,
          status: 'approved',
          external_reference: checkoutPaymentId,
        }),
      });

      const res = await request(app.getHttpServer())
        .post('/api/v1/payments/webhook')
        .query({ topic: 'payment', id: mpPaymentId })
        .expect(201);

      expect(res.body.received).toBe(true);

      const payment = await prisma.payment.findUnique({ where: { id: checkoutPaymentId } });
      expect(payment.status).toBe('PAID');
      expect(payment.paidAmount).toBe(15000);
      expect(payment.mpPaymentId).toBe(mpPaymentId);
      expect(payment.paidAt).toBeTruthy();
    });

    it('should show payment as PAID in list', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/payments/${checkoutPaymentId}`)
        .set('Authorization', `Bearer ${jwtToken}`)
        .expect(200);

      expect(res.body.id).toBe(checkoutPaymentId);
      expect(res.body.status).toBe('PAID');
      expect(res.body.client.name).toBe('E2E Client');
      expect(res.body.items).toHaveLength(1);
    });
  });

  describe('MP_QR flow (via MercadopagoController)', () => {
    it('should create a PENDING payment for QR', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/payments')
        .set('Authorization', `Bearer ${jwtToken}`)
        .send({
          clientId,
          totalAmount: 8000,
          method: 'MP_QR',
          status: 'PENDING',
          items: [
            { description: 'Análisis clínicos', quantity: 1, unitPrice: 8000, totalPrice: 8000, itemType: 'CONSULTATION' },
          ],
        })
        .expect(201);

      expect(res.body.id).toBeTruthy();
      qrPaymentId = res.body.id;
    });

    it('should generate QR code with the real MercadopagoService', async () => {
      vi.spyOn(globalThis as any, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({
          qr_data: '00020101021243650016COM.MERCADOLIBRE02014TEST1234567890320MPQR123',
          in_store_order_id: 'order-e2e-qr-001',
        }),
      });

      const res = await request(app.getHttpServer())
        .post('/api/v1/mercadopago/qr')
        .set('Authorization', `Bearer ${jwtToken}`)
        .send({
          paymentId: qrPaymentId,
          description: 'Pago QR E2E test',
          amount: 8000,
        })
        .expect(201);

      expect(res.body.qrData).toBeTruthy();
      expect(res.body.qrData).toContain('MERCADOLIBRE');
      expect(res.body.qrData).toContain('TEST123456789');
      expect(res.body.orderId).toBe('order-e2e-qr-001');
      expect(res.body.amount).toBe(8000);

      const fetchCalls = (globalThis.fetch as any).mock.calls;
      const lastCall = fetchCalls[fetchCalls.length - 1];
      expect(lastCall[0]).toContain('api.mercadopago.com/instore/orders/qr/seller/collectors/');
    });
  });

  describe('TRANSFER payment flow (with debt creation)', () => {
    const tomorrow = (() => { const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString(); })();

    it('should create a DEFERRED TRANSFER payment with debt', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/payments')
        .set('Authorization', `Bearer ${jwtToken}`)
        .send({
          clientId,
          totalAmount: 12000,
          method: 'TRANSFER',
          status: 'DEFERRED',
          dueDate: tomorrow,
          interestRate: 5,
          items: [
            { description: 'Ecografía', quantity: 1, unitPrice: 12000, totalPrice: 12000, itemType: 'CONSULTATION' },
          ],
        })
        .expect(201);

      expect(res.body.id).toBeTruthy();
      expect(res.body.status).toBe('DEFERRED');
      expect(res.body.method).toBe('TRANSFER');
      transferPaymentId = res.body.id;

      const debt = await prisma.debt.findFirst({ where: { paymentId: transferPaymentId } });
      expect(debt).toBeTruthy();
      expect(debt.amount).toBe(12000);
      expect(debt.status).toBe('PENDING');
      expect(debt.interestRate).toBe(5);
      expect(debt.clientId).toBe(clientId);
    });

    it('should update TRANSFER payment to PAID and mark debt resolved', async () => {
      await request(app.getHttpServer())
        .patch(`/api/v1/payments/${transferPaymentId}`)
        .set('Authorization', `Bearer ${jwtToken}`)
        .send({
          status: 'PAID',
          paidAmount: 12000,
          method: 'TRANSFER',
        })
        .expect(200);

      const payment = await prisma.payment.findUnique({
        where: { id: transferPaymentId },
        include: { debt: true },
      });
      expect(payment.status).toBe('PAID');
      expect(payment.paidAmount).toBe(12000);
      expect(payment.debt.status).toBe('PAID');
      expect(payment.debt.paidAt).toBeTruthy();
    });
  });

  describe('CHECK payment flow (with debt creation)', () => {
    const tomorrow = (() => { const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString(); })();

    it('should create a DEFERRED CHECK payment with debt', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/payments')
        .set('Authorization', `Bearer ${jwtToken}`)
        .send({
          clientId,
          totalAmount: 25000,
          method: 'CHECK',
          status: 'DEFERRED',
          dueDate: tomorrow,
          notes: 'Cheque diferido a 30 días',
          items: [
            { description: 'Cirugía de tejidos', quantity: 1, unitPrice: 25000, totalPrice: 25000, itemType: 'PROCEDURE' },
          ],
        })
        .expect(201);

      expect(res.body.id).toBeTruthy();
      expect(res.body.status).toBe('DEFERRED');
      expect(res.body.method).toBe('CHECK');
      checkPaymentId = res.body.id;

      const debt = await prisma.debt.findFirst({ where: { paymentId: checkPaymentId } });
      expect(debt).toBeTruthy();
      expect(debt.amount).toBe(25000);
      expect(debt.notes).toBe('Cheque diferido a 30 días');
    });

    it('should update CHECK payment to PAID and mark debt resolved', async () => {
      await request(app.getHttpServer())
        .patch(`/api/v1/payments/${checkPaymentId}`)
        .set('Authorization', `Bearer ${jwtToken}`)
        .send({
          status: 'PAID',
          paidAmount: 25000,
          method: 'CHECK',
        })
        .expect(200);

      const payment = await prisma.payment.findUnique({
        where: { id: checkPaymentId },
        include: { debt: true },
      });
      expect(payment.status).toBe('PAID');
      expect(payment.paidAmount).toBe(25000);
      expect(payment.debt.status).toBe('PAID');
    });
  });

  describe('Payment listing and filtering', () => {
    it('should list all payments with pagination', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/payments')
        .set('Authorization', `Bearer ${jwtToken}`)
        .expect(200);

      expect(res.body.data).toBeInstanceOf(Array);
      expect(res.body.data.length).toBeGreaterThanOrEqual(5);
      expect(res.body.meta.total).toBeGreaterThanOrEqual(5);
    });

    it('should filter by payment status', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/payments?status=PAID')
        .set('Authorization', `Bearer ${jwtToken}`)
        .expect(200);

      expect(res.body.data).toBeInstanceOf(Array);
      res.body.data.forEach((p: any) => expect(p.status).toBe('PAID'));
    });

    it('should filter by clientId', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/payments?clientId=${clientId}`)
        .set('Authorization', `Bearer ${jwtToken}`)
        .expect(200);

      expect(res.body.data).toBeInstanceOf(Array);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
      res.body.data.forEach((p: any) => expect(p.clientId).toBe(clientId));
    });
  });
});
