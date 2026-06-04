import { PrismaClient, UserRole, SubscriptionPlan, SubscriptionStatus } from '@prisma/client';

const prisma = new PrismaClient();

export async function createTestCompany(overrides: Record<string, any> = {}) {
  const slug = `test-company-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return prisma.company.create({
    data: {
      name: overrides.name || `Test Company ${Date.now()}`,
      slug,
      email: overrides.email || `${slug}@test.com`,
      phone: overrides.phone || '1234567890',
      address: overrides.address || 'Test Address 123',
      city: overrides.city || 'Buenos Aires',
      province: overrides.province || 'CABA',
      ...overrides,
    },
  });
}

export async function createTestUser(companyId: string, overrides: Record<string, any> = {}) {
  const email = `test-user-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@test.com`;
  return prisma.user.create({
    data: {
      name: overrides.name || 'Test User',
      email: overrides.email || email,
      password: overrides.password || '$2b$12$LJ3m4ys3Gl.MkUSfUPbmRuGpRFpJLGHm5p5VlYB0xKHX6dPXcGq2a',
      role: overrides.role || UserRole.USER,
      companyId,
      ...overrides,
    },
  });
}

export async function createTestSubscription(companyId: string, overrides: Record<string, any> = {}) {
  const now = new Date();
  const trialEnds = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  return prisma.subscription.create({
    data: {
      companyId,
      plan: overrides.plan || SubscriptionPlan.TRIAL,
      status: overrides.status || SubscriptionStatus.ACTIVE,
      trialEndsAt: overrides.trialEndsAt || trialEnds,
      expiresAt: overrides.expiresAt || trialEnds,
      ...overrides,
    },
  });
}

export async function createTestClient(companyId: string, overrides: Record<string, any> = {}) {
  return prisma.client.create({
    data: {
      name: overrides.name || `Test Client ${Date.now()}`,
      dni: overrides.dni || `${Math.floor(Math.random() * 90000000) + 10000000}`,
      email: overrides.email || `client-${Date.now()}@test.com`,
      phone: overrides.phone || '1234567890',
      companyId,
      ...overrides,
    },
  });
}

export async function createTestPet(companyId: string, clientId: string, overrides: Record<string, any> = {}) {
  return prisma.pet.create({
    data: {
      name: overrides.name || `Test Pet ${Date.now()}`,
      species: overrides.species || 'Dog',
      breed: overrides.breed || 'Labrador',
      birthDate: overrides.birthDate || new Date('2020-01-01'),
      clientId,
      companyId,
      ...overrides,
    },
  });
}

export async function createTestSupply(companyId: string, overrides: Record<string, any> = {}) {
  return prisma.supply.create({
    data: {
      name: overrides.name || `Test Supply ${Date.now()}`,
      brand: overrides.brand || 'TestBrand',
      stock: overrides.stock ?? 100,
      minStock: overrides.minStock ?? 10,
      unitPrice: overrides.unitPrice ?? 500,
      salePrice: overrides.salePrice ?? 1000,
      unitsPerStock: overrides.unitsPerStock ?? 1,
      companyId,
      ...overrides,
    },
  });
}

export async function createTestPriceItem(companyId: string, overrides: Record<string, any> = {}) {
  return prisma.priceItem.create({
    data: {
      name: overrides.name || `Test Price Item ${Date.now()}`,
      price: overrides.price ?? 2000,
      category: overrides.category || 'Consulta',
      companyId,
      ...overrides,
    },
  });
}

export async function cleanupTestData() {
  const testPrefix = 'test-';
  const testCompanies = await prisma.company.findMany({
    where: { slug: { startsWith: testPrefix } },
    select: { id: true },
  });

  if (testCompanies.length === 0) return;

  const companyIds = testCompanies.map(c => c.id);

  await prisma.$transaction([
    prisma.notification.deleteMany({ where: { companyId: { in: companyIds } } }),
    prisma.cashMovement.deleteMany({ where: { companyId: { in: companyIds } } }),
    prisma.prescription.deleteMany({
      where: { medicalRecord: { companyId: { in: companyIds } } },
    }),
    prisma.procedure.deleteMany({
      where: { medicalRecord: { companyId: { in: companyIds } } },
    }),
    prisma.paymentItem.deleteMany({
      where: { payment: { companyId: { in: companyIds } } },
    }),
    prisma.debt.deleteMany({ where: { companyId: { in: companyIds } } }),
    prisma.payment.deleteMany({ where: { companyId: { in: companyIds } } }),
    prisma.medicalRecord.deleteMany({ where: { companyId: { in: companyIds } } }),
    prisma.petPhoto.deleteMany({ where: { pet: { companyId: { in: companyIds } } } }),
    prisma.pet.deleteMany({ where: { companyId: { in: companyIds } } }),
    prisma.client.deleteMany({ where: { companyId: { in: companyIds } } }),
    prisma.supply.deleteMany({ where: { companyId: { in: companyIds } } }),
    prisma.priceItem.deleteMany({ where: { companyId: { in: companyIds } } }),
    prisma.document.deleteMany({ where: { companyId: { in: companyIds } } }),
    prisma.refreshToken.deleteMany({ where: { user: { companyId: { in: companyIds } } } }),
    prisma.user.deleteMany({ where: { companyId: { in: companyIds } } }),
    prisma.subscription.deleteMany({ where: { companyId: { in: companyIds } } }),
    prisma.companyConfig.deleteMany({ where: { companyId: { in: companyIds } } }),
    prisma.company.deleteMany({ where: { id: { in: companyIds } } }),
  ]);
}

export { prisma };
