import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { CompaniesService } from './companies.service';

describe('CompaniesService', () => {
  let service: CompaniesService;
  let mockPrisma: any;
  let mockConfig: any;

  beforeEach(() => {
    mockPrisma = {
      company: {
        findMany: vi.fn().mockResolvedValue([]),
        findUnique: vi.fn().mockResolvedValue(null),
        findFirst: vi.fn().mockResolvedValue(null),
        count: vi.fn().mockResolvedValue(0),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      user: {
        findUnique: vi.fn().mockResolvedValue(null),
      },
      $transaction: vi.fn().mockImplementation(async (queries) => {
        return Promise.all(queries);
      }),
    };
    mockConfig = {
      get: vi.fn().mockReturnValue('test'),
    };
    service = new CompaniesService(mockPrisma, mockConfig);
  });

  describe('findAll', () => {
    it('should return paginated companies', async () => {
      const companies = [{ id: '1', name: 'Vet A' }, { id: '2', name: 'Vet B' }];
      mockPrisma.company.findMany.mockResolvedValue(companies);
      mockPrisma.company.count.mockResolvedValue(2);

      const result = await service.findAll({ page: 1, limit: 10 });

      expect(result.data).toEqual(companies);
      expect(result.meta.total).toBe(2);
      expect(result.meta.page).toBe(1);
      expect(result.meta.limit).toBe(10);
      expect(result.meta.totalPages).toBe(1);
    });

    it('should use default pagination values', async () => {
      mockPrisma.company.findMany.mockResolvedValue([]);
      mockPrisma.company.count.mockResolvedValue(0);

      const result = await service.findAll();

      expect(result.meta.page).toBe(1);
      expect(result.meta.limit).toBe(20);
    });
  });

  describe('findOne', () => {
    it('should return company with config, subscription and users', async () => {
      const company = { id: '1', name: 'Vet A', config: {}, subscription: {}, users: [] };
      mockPrisma.company.findUnique.mockResolvedValue(company);

      const result = await service.findOne('1');

      expect(result).toEqual(company);
      expect(mockPrisma.company.findUnique).toHaveBeenCalledWith({
        where: { id: '1' },
        include: { config: true, subscription: true, users: { select: { id: true, name: true, email: true, role: true } } },
      });
    });

    it('should throw NotFoundException if company not found', async () => {
      mockPrisma.company.findUnique.mockResolvedValue(null);

      await expect(service.findOne('999')).rejects.toThrow(NotFoundException);
      await expect(service.findOne('999')).rejects.toThrow('Empresa no encontrada');
    });
  });

  describe('findMyCompany', () => {
    it('should return company for user with companyId', async () => {
      const company = { id: 'c1', name: 'My Vet', config: {}, subscription: {} };
      mockPrisma.user.findUnique.mockResolvedValue({ id: '1', companyId: 'c1', company });

      const result = await service.findMyCompany('1');

      expect(result).toEqual(company);
    });

    it('should return null for user without companyId', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: '1', companyId: null, company: null });

      const result = await service.findMyCompany('1');

      expect(result).toBeNull();
    });

    it('should return null if user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const result = await service.findMyCompany('999');

      expect(result).toBeNull();
    });
  });

  describe('create', () => {
    it('should create company with config and TRIAL subscription', async () => {
      const userId = 'user-1';
      const dto = { name: 'Veterinaria San Martin', email: 'vet@test.com' };
      const company = {
        id: 'c1',
        name: dto.name,
        slug: 'veterinaria-san-martin',
        config: { currency: 'ARS' },
        subscription: { plan: 'TRIAL', status: 'TRIAL' },
      };

      mockPrisma.user.findUnique.mockResolvedValue({ id: userId, companyId: null });
      mockPrisma.company.findUnique.mockResolvedValue(null);
      mockPrisma.company.create.mockResolvedValue(company);

      const result = await service.create(userId, dto);

      expect(result).toEqual(company);
      expect(mockPrisma.company.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name: dto.name,
          slug: 'veterinaria-san-martin',
          users: { connect: { id: userId } },
          config: {
            create: expect.objectContaining({
              currency: 'ARS',
              defaultAIModel: 'llama-3.3-70b-versatile',
              onboardComplete: true,
            }),
          },
          subscription: {
            create: expect.objectContaining({
              plan: 'TRIAL',
              status: 'TRIAL',
            }),
          },
        }),
        include: { config: true, subscription: true },
      });
    });

    it('should throw BadRequestException if user already has a company', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-1', companyId: 'existing-company' });

      await expect(service.create('user-1', { name: 'New Vet' })).rejects.toThrow(BadRequestException);
      await expect(service.create('user-1', { name: 'New Vet' })).rejects.toThrow('Ya tienes una empresa asociada');
    });

    it('should throw BadRequestException if CUIT already exists', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-1', companyId: null });
      mockPrisma.company.findUnique.mockImplementation(({ where }) => {
        if (where.cuit) return { id: 'existing', cuit: where.cuit };
        return null;
      });

      await expect(service.create('user-1', { name: 'Vet', cuit: '20-12345678-9' }))
        .rejects.toThrow('El CUIT ya está registrado');
    });

    it('should generate unique slug when name already exists', async () => {
      const userId = 'user-1';
      const dto = { name: 'Veterinaria Central' };

      mockPrisma.user.findUnique.mockResolvedValue({ id: userId, companyId: null });
      mockPrisma.company.findUnique.mockImplementation(({ where }) => {
        if (where.slug === 'veterinaria-central') return { id: 'existing' };
        return null;
      });
      mockPrisma.company.create.mockResolvedValue({ id: 'c2', slug: 'veterinaria-central-123456' });

      await service.create(userId, dto);

      const createCall = mockPrisma.company.create.mock.calls[0][0];
      expect(createCall.data.slug).toMatch(/^veterinaria-central-\d+$/);
    });

    it('should create TRIAL subscription with 72 hours', async () => {
      const userId = 'user-1';
      const dto = { name: 'Test Vet' };

      mockPrisma.user.findUnique.mockResolvedValue({ id: userId, companyId: null });
      mockPrisma.company.findUnique.mockResolvedValue(null);
      mockPrisma.company.create.mockResolvedValue({ id: 'c1' });

      await service.create(userId, dto);

      const createCall = mockPrisma.company.create.mock.calls[0][0];
      const trialEndsAt = createCall.data.subscription.create.trialEndsAt;
      const expectedEnd = new Date(Date.now() + 72 * 60 * 60 * 1000);

      expect(trialEndsAt).toBeInstanceOf(Date);
      expect(Math.abs(trialEndsAt.getTime() - expectedEnd.getTime())).toBeLessThan(5000);
    });
  });

  describe('update', () => {
    it('should update company if user owns it', async () => {
      const companyId = 'c1';
      const userId = 'user-1';
      const dto = { name: 'Updated Name' };
      const updated = { id: companyId, name: 'Updated Name', config: {} };

      mockPrisma.user.findUnique.mockResolvedValue({ id: userId, companyId });
      mockPrisma.company.findFirst.mockResolvedValue(null);
      mockPrisma.company.update.mockResolvedValue(updated);

      const result = await service.update(companyId, userId, dto);

      expect(result.name).toBe('Updated Name');
    });

    it('should throw BadRequestException if user does not own the company', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-1', companyId: 'other-company' });

      await expect(service.update('c1', 'user-1', { name: 'X' }))
        .rejects.toThrow('No tienes permiso para modificar esta empresa');
    });

    it('should throw BadRequestException if name already in use', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-1', companyId: 'c1' });
      mockPrisma.company.findFirst.mockResolvedValue({ id: 'c2', name: 'Taken Name' });

      await expect(service.update('c1', 'user-1', { name: 'Taken Name' }))
        .rejects.toThrow('El nombre ya está en uso');
    });
  });

  describe('delete', () => {
    it('should delete company if user is ADMIN_COMPANY', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-1', companyId: 'c1', role: 'ADMIN_COMPANY' });
      mockPrisma.company.delete.mockResolvedValue({});

      await service.delete('c1', 'user-1');

      expect(mockPrisma.company.delete).toHaveBeenCalledWith({ where: { id: 'c1' } });
    });

    it('should delete company if user is SUPER_ADMIN', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-1', companyId: 'c1', role: 'SUPER_ADMIN' });
      mockPrisma.company.delete.mockResolvedValue({});

      await service.delete('c1', 'user-1');

      expect(mockPrisma.company.delete).toHaveBeenCalled();
    });

    it('should throw BadRequestException if user does not own the company', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-1', companyId: 'other', role: 'ADMIN_COMPANY' });

      await expect(service.delete('c1', 'user-1'))
        .rejects.toThrow('No tienes permiso para eliminar esta empresa');
    });

    it('should throw BadRequestException if user is not admin', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-1', companyId: 'c1', role: 'USER' });

      await expect(service.delete('c1', 'user-1'))
        .rejects.toThrow('No tienes permiso de administrador');
    });
  });

  describe('findBySlug', () => {
    it('should return company by slug', async () => {
      const company = { id: '1', name: 'Vet', slug: 'vet', logoUrl: null, animalSpecialties: ['general'] };
      mockPrisma.company.findUnique.mockResolvedValue(company);

      const result = await service.findBySlug('vet');

      expect(result).toEqual(company);
    });
  });

  describe('search', () => {
    it('should return empty array for short queries', async () => {
      const result = await service.search('a', 'c1');

      expect(result).toEqual([]);
      expect(mockPrisma.company.findMany).not.toHaveBeenCalled();
    });

    it('should search by name or email', async () => {
      const results = [{ id: '1', name: 'Veterinaria', email: 'vet@test.com' }];
      mockPrisma.company.findMany.mockResolvedValue(results);

      const result = await service.search('vete', 'c1');

      expect(result).toEqual(results);
      expect(mockPrisma.company.findMany).toHaveBeenCalledWith({
        where: {
          id: { not: 'c1' },
          OR: [
            { name: { contains: 'vete', mode: 'insensitive' } },
            { email: { contains: 'vete', mode: 'insensitive' } },
          ],
        },
        select: { id: true, name: true, email: true },
        take: 10,
      });
    });
  });

  describe('multi-tenant isolation', () => {
    it('should generate slug correctly for special characters', async () => {
      const userId = 'user-1';
      const dto = { name: 'Veterinaria El Ñandú' };

      mockPrisma.user.findUnique.mockResolvedValue({ id: userId, companyId: null });
      mockPrisma.company.findUnique.mockResolvedValue(null);
      mockPrisma.company.create.mockResolvedValue({ id: 'c1' });

      await service.create(userId, dto);

      const createCall = mockPrisma.company.create.mock.calls[0][0];
      expect(createCall.data.slug).toBe('veterinaria-el-nandu');
    });
  });
});
