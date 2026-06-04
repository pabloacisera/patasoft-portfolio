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
import { SubscriptionsService } from '../../src/subscriptions/subscriptions.service';
import { SubscriptionsController } from '../../src/subscriptions/subscriptions.controller';
import { RedisService } from '../../src/redis/redis.service';
import { JwtModule } from '@nestjs/jwt';
import { JwtAuthGuard } from '../../src/auth/guards/jwt-auth.guard';

// ======================================================================
// MP SANDBOX VERIFICATION
// ======================================================================
// Crea preferencias reales en MP sandbox y completa los pagos via API
// directa usando tarjetas de prueba, saltándose el browser.
//
// Uso:
//   MP_TEST_TOKEN=TEST-6236905547231165-... npx vitest run --config vitest.e2e.config.ts \
//     test/integration/mp-sandbox-verify.e2e-spec.ts
//
// No modifica archivos de producción. Usa DB patasoft_test.
// ======================================================================

const MP_TEST_TOKEN = process.env.MP_TEST_TOKEN;
const BACKEND_URL = 'https://api-patasoft.artisandevs.site';

function uuidv4(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// Crea un pago aprobado en sandbox usando tarjeta de prueba de Mastercard
// Sin browser, via API directa de MP.
async function createTestPaymentInSandbox(
  externalReference: string,
  amount: number,
): Promise<{ mpPaymentId: string; status: string }> {
  // Step 1: Create card token with test card (Mastercard - auto approves)
  const cardRes = await fetch('https://api.mercadopago.com/v1/card_tokens', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${MP_TEST_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      card_number: '5031755734530604',
      expiration_month: 11,
      expiration_year: 2028,
      security_code: '123',
      cardholder: {
        name: 'APRO',
        identification: { type: 'CPF', number: '19119119100' },
      },
    }),
  });
  if (!cardRes.ok) {
    const errBody = await cardRes.text();
    throw new Error(`Failed to create card token: ${cardRes.status} ${errBody}`);
  }
  const cardData = await cardRes.json() as any;
  const cardToken = cardData.id as string;
  console.log(`  → Card token creado: ${cardToken}`);

  // Step 2: Create payment (auto-approved in sandbox)
  const idempotencyKey = uuidv4();
  const payRes = await fetch('https://api.mercadopago.com/v1/payments', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${MP_TEST_TOKEN}`,
      'Content-Type': 'application/json',
      'X-Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify({
      token: cardToken,
      installments: 1,
      payment_method_id: 'master',
      transaction_amount: amount,
      description: 'Test payment from integration test',
      payer: {
        email: 'test_user_123@testuser.com',
        identification: { type: 'CPF', number: '19119119100' },
      },
      external_reference: externalReference,
    }),
  });
  if (!payRes.ok) {
    const errBody = await payRes.text();
    throw new Error(`Failed to create payment: ${payRes.status} ${errBody}`);
  }
  const payData = await payRes.json() as any;
  console.log(`  → Pago MP creado: id=${payData.id}, status=${payData.status}, external_reference=${payData.external_reference}`);

  return {
    mpPaymentId: String(payData.id),
    status: payData.status as string,
  };
}

describe.skipIf(!MP_TEST_TOKEN)('MP Sandbox Real Verification', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let currentCompanyId: string;
  let jwtToken: string;
  let clientId: string;

  const mockPdfService = {
    generateReceipt: vi.fn().mockResolvedValue(Buffer.from('fake-pdf')),
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
    process.env.MP_ACCESS_TOKEN = MP_TEST_TOKEN;
    process.env.BACKEND_URL = BACKEND_URL;
    process.env.FRONTEND_URL = 'https://test.com';
    process.env.MP_PLAN_MONTHLY_PRICE = '27000';
    process.env.MP_PLAN_YEARLY_PRICE = '240000';
    process.env.MP_SUCCESS_URL = `${BACKEND_URL}/api/v1/subscriptions/success`;
    process.env.MP_FAILURE_URL = `${BACKEND_URL}/api/v1/subscriptions/failure`;
    process.env.MP_PENDING_URL = `${BACKEND_URL}/api/v1/subscriptions/pending`;

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }),
        JwtModule.register({ secret: 'test-jwt-secret', signOptions: { expiresIn: '1h' } }),
      ],
      controllers: [SubscriptionsController, PaymentsController, MercadopagoController],
      providers: [
        SubscriptionsService,
        PaymentsService,
        MercadopagoService,
        CashRegisterService,
        PrismaService,
        { provide: RedisService, useValue: { get: vi.fn().mockResolvedValue(null), set: vi.fn().mockResolvedValue(undefined), del: vi.fn().mockResolvedValue(undefined) } },
        { provide: PdfService, useValue: mockPdfService },
        { provide: EventsGateway, useValue: mockEventsGateway },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context: any) => {
          const req = context.switchToHttp().getRequest();
          req.user = { id: 'test-user', companyId: currentCompanyId, role: 'USER' };
          return true;
        },
      })
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);

    const slug = `mp-verify-${Date.now()}`;
    const company = await prisma.company.create({
      data: {
        name: 'MP Verify',
        slug,
        cuit: String(Date.now()).slice(0, 11),
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
        mpAccessToken: MP_TEST_TOKEN,
        mpUserId: '1933082643',
        mpPublicKey: 'TEST-683e0f53-bee2-4bd5-a578-9a4e889c3612',
      },
    });

    const cli = await prisma.client.create({
      data: {
        companyId: currentCompanyId,
        name: 'Test Buyer',
        email: 'buyer@test.com',
        phone: '1111111111',
      },
    });
    clientId = cli.id;

    const user = await prisma.user.create({
      data: {
        name: 'Test User',
        email: `user-${Date.now()}@test.com`,
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
      await prisma.subscription.deleteMany({ where: { companyId: currentCompanyId } });
      await prisma.client.deleteMany({ where: { companyId: currentCompanyId } });
      await prisma.user.deleteMany({ where: { companyId: currentCompanyId } });
      await prisma.companyConfig.deleteMany({ where: { companyId: currentCompanyId } });
      await prisma.company.deleteMany({ where: { id: currentCompanyId } });
      await prisma.$disconnect();
    }
    if (app) await app.close();
  });

  // ============================================================================
  // FLUJO 1: SUSCRIPCIÓN (usuario app → desarrollador)
  // ============================================================================
  describe('Flow 1: Subscription (user pays developer)', () => {
    let mpPaymentId: string;
    let initPoint: string;
    let preferenceId: string;

    it('1.1 should create subscription checkout with real MP API', async () => {
      await prisma.subscription.create({
        data: {
          companyId: currentCompanyId,
          plan: 'TRIAL',
          status: 'ACTIVE',
          trialEndsAt: new Date(Date.now() + 30 * 86400000),
        },
      });

      const res = await request(app.getHttpServer())
        .post('/api/v1/subscriptions/checkout')
        .set('Authorization', `Bearer ${jwtToken}`)
        .send({ plan: 'MONTHLY' })
        .expect(201);

      expect(res.body.initPoint).toBeTruthy();
      expect(res.body.initPoint).toContain('mercadopago.com');
      expect(res.body.initPoint).toContain('pref_id=');

      initPoint = res.body.initPoint;
      preferenceId = res.body.initPoint.match(/pref_id=([^&]+)/)?.[1];

      console.log(`  → Subscription init_point creado (pref_id: ${preferenceId})`);
    });

    it('1.2 MP init_point should be reachable', async () => {
      const res = await fetch(initPoint, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        redirect: 'manual',
      });
      expect([200, 301, 302, 303, 307, 308]).toContain(res.status);
      console.log(`  → init_point responde: ${res.status}`);
    });

    it('1.3 create approved payment via MP API (bypass browser)', async () => {
      const extRef = JSON.stringify({ type: 'subscription', companyId: currentCompanyId, plan: 'MONTHLY' });
      const result = await createTestPaymentInSandbox(extRef, 27000);
      expect(result.status).toBe('approved');
      mpPaymentId = result.mpPaymentId;
      console.log(`  → Pago subscription creado y aprobado via API. ID: ${mpPaymentId}`);
    });

    it('1.4 should fetch payment from MP API and verify external_reference', async () => {
      const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${mpPaymentId}`, {
        headers: { Authorization: `Bearer ${MP_TEST_TOKEN}` },
      });
      expect(mpRes.ok).toBe(true);
      const paymentData = await mpRes.json() as any;
      expect(paymentData.status).toBe('approved');
      expect(paymentData.external_reference).toContain('subscription');
      console.log(`  → MP confirma: status=${paymentData.status}, external_reference contiene "subscription"`);
    });

    it('1.5 should process webhook locally and update subscription', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/subscriptions/webhook')
        .send({ type: 'payment', data: { id: mpPaymentId } })
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

      console.log(`  → Subscription activada en DB: plan=${subscription.plan}, expiresAt=${subscription.expiresAt}`);
    });
  });

  // ============================================================================
  // FLUJO 2: PAGO DE CLIENTE (cliente → usuario app)
  // ============================================================================
  describe('Flow 2: Client Payment (client pays app user)', () => {
    let paymentId: string;
    let initPoint: string;
    let mpPaymentId: string;
    let preferenceId: string;

    it('2.1 should create client payment in DB', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/payments')
        .set('Authorization', `Bearer ${jwtToken}`)
        .send({
          clientId,
          totalAmount: 5000,
          method: 'MP_CHECKOUT',
          status: 'PENDING',
          items: [
            { description: 'Consulta', quantity: 1, unitPrice: 3000, totalPrice: 3000, itemType: 'CONSULTATION' },
            { description: 'Vacuna', quantity: 1, unitPrice: 2000, totalPrice: 2000, itemType: 'SUPPLY' },
          ],
        })
        .expect(201);

      paymentId = res.body.id;
      console.log(`  → Payment creado en DB: ${paymentId}`);
    });

    it('2.2 should create MP checkout link with real MercadopagoService', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/payments/${paymentId}/checkout`)
        .set('Authorization', `Bearer ${jwtToken}`)
        .expect(201);

      expect(res.body.initPoint).toBeTruthy();
      expect(res.body.initPoint).toContain('mercadopago.com');
      expect(res.body.preferenceId).toBeTruthy();

      initPoint = res.body.initPoint;
      preferenceId = res.body.preferenceId;
      console.log(`  → Client payment init_point creado (pref_id: ${res.body.preferenceId})`);
    });

    it('2.3 MP init_point should be reachable', async () => {
      const res = await fetch(initPoint, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        redirect: 'manual',
      });
      expect([200, 301, 302, 303, 307, 308]).toContain(res.status);
      console.log(`  → Client payment init_point responde: ${res.status}`);
    });

    it('2.4 create approved client payment via MP API (bypass browser)', async () => {
      // external_reference = payment.id (same as what MercadoPagoService sets)
      const result = await createTestPaymentInSandbox(paymentId, 5000);
      expect(result.status).toBe('approved');
      mpPaymentId = result.mpPaymentId;
      console.log(`  → Pago cliente creado y aprobado via API. ID: ${mpPaymentId}`);
    });

    it('2.5 should fetch client payment from MP API', async () => {
      const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${mpPaymentId}`, {
        headers: { Authorization: `Bearer ${MP_TEST_TOKEN}` },
      });
      expect(mpRes.ok).toBe(true);
      const paymentData = await mpRes.json() as any;
      expect(paymentData.status).toBe('approved');
      expect(paymentData.external_reference).toBe(paymentId);
      console.log(`  → MP confirma pago cliente: status=${paymentData.status}, external_reference=${paymentData.external_reference}`);
    });

    it('2.6 should process payment webhook locally and update DB', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/payments/webhook')
        .query({ topic: 'payment', id: mpPaymentId })
        .expect(201);

      expect(res.body.received).toBe(true);

      const payment = await prisma.payment.findUnique({
        where: { id: paymentId },
        include: { items: true },
      });
      expect(payment.status).toBe('PAID');
      expect(payment.paidAmount).toBe(5000);
      expect(payment.mpPaymentId).toBe(mpPaymentId);
      expect(payment.paidAt).toBeTruthy();

      const cashMovement = await prisma.cashMovement.findFirst({
        where: { paymentId },
      });
      expect(cashMovement).toBeTruthy();
      expect(cashMovement.type).toBe('INCOME');
      expect(cashMovement.amount).toBe(5000);

      console.log(`  → Payment actualizado en DB: status=PAID, cashMovement creado`);
    });
  });
});
