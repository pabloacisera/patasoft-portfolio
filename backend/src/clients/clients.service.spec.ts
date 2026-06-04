import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { ClientsService } from './clients.service';

describe('ClientsService', () => {
  let service: ClientsService;
  let mockPrisma: any;
  let mockRag: any;

  const companyId = 'company-1';

  beforeEach(() => {
    mockPrisma = {
      client: {
        findMany: vi.fn().mockResolvedValue([]),
        findFirst: vi.fn().mockResolvedValue(null),
        count: vi.fn().mockResolvedValue(0),
        create: vi.fn(),
        update: vi.fn(),
      },
      pet: {
        findMany: vi.fn().mockResolvedValue([]),
        count: vi.fn().mockResolvedValue(0),
      },
      payment: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      debt: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      $transaction: vi.fn().mockImplementation(async (queries) => {
        return Promise.all(queries);
      }),
    };
    mockRag = {
      upsertEmbedding: vi.fn().mockResolvedValue(undefined),
      deleteEmbedding: vi.fn().mockResolvedValue(undefined),
    };
    service = new ClientsService(mockPrisma, mockRag);
  });

  describe('findAll', () => {
    it('should return paginated clients for company', async () => {
      const clients = [{ id: '1', name: 'Juan', isDeleted: false }];
      mockPrisma.client.findMany.mockResolvedValue(clients);
      mockPrisma.client.count.mockResolvedValue(1);

      const result = await service.findAll(companyId, { page: 1, limit: 10 });

      expect(result.data).toEqual(clients);
      expect(result.meta.total).toBe(1);
      expect(result.meta.page).toBe(1);
    });

    it('should filter by search term across name, lastName, email, phone', async () => {
      mockPrisma.client.findMany.mockResolvedValue([]);
      mockPrisma.client.count.mockResolvedValue(0);

      await service.findAll(companyId, { search: 'juan' });

      const where = mockPrisma.client.findMany.mock.calls[0][0].where;
      expect(where.companyId).toBe(companyId);
      expect(where.isDeleted).toBe(false);
      expect(where.OR).toHaveLength(4);
      expect(where.OR[0]).toEqual({ name: { contains: 'juan', mode: 'insensitive' } });
    });

    it('should always filter out deleted clients', async () => {
      mockPrisma.client.findMany.mockResolvedValue([]);
      mockPrisma.client.count.mockResolvedValue(0);

      await service.findAll(companyId);

      const where = mockPrisma.client.findMany.mock.calls[0][0].where;
      expect(where.isDeleted).toBe(false);
    });
  });

  describe('findOne', () => {
    it('should return client with pets, payments and debts', async () => {
      const client = { id: '1', name: 'Juan', companyId, pets: [], payments: [], debts: [] };
      mockPrisma.client.findFirst.mockResolvedValue(client);

      const result = await service.findOne('1', companyId);

      expect(result).toEqual(client);
      expect(mockPrisma.client.findFirst).toHaveBeenCalledWith({
        where: { id: '1', companyId },
        include: {
          pets: { include: { photos: true } },
          payments: { orderBy: { createdAt: 'desc' }, take: 10 },
          debts: { orderBy: { createdAt: 'desc' }, take: 10 },
        },
      });
    });

    it('should throw NotFoundException if client not found', async () => {
      mockPrisma.client.findFirst.mockResolvedValue(null);

      await expect(service.findOne('999', companyId)).rejects.toThrow(NotFoundException);
      await expect(service.findOne('999', companyId)).rejects.toThrow('Cliente no encontrado');
    });

    it('should throw NotFoundException if client belongs to another company', async () => {
      mockPrisma.client.findFirst.mockResolvedValue(null);

      await expect(service.findOne('1', 'other-company')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('should create client and trigger RAG upsert', async () => {
      const dto = { name: 'Juan', lastName: 'Perez', email: 'juan@test.com' };
      const client = { id: '1', companyId, ...dto, pets: [] };
      mockPrisma.client.create.mockResolvedValue(client);

      const result = await service.create(companyId, dto);

      expect(result).toEqual(client);
      expect(mockPrisma.client.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          companyId,
          name: 'Juan',
          lastName: 'Perez',
          email: 'juan@test.com',
          isCompany: false,
        }),
        include: { pets: true },
      });
      expect(mockRag.upsertEmbedding).toHaveBeenCalledWith(
        companyId,
        expect.stringContaining('Cliente Juan Perez'),
        expect.objectContaining({ source: 'client', clientId: '1' }),
      );
    });

    it('should default isCompany to false', async () => {
      const dto = { name: 'Test' };
      mockPrisma.client.create.mockResolvedValue({ id: '1', companyId, ...dto });

      await service.create(companyId, dto);

      const createCall = mockPrisma.client.create.mock.calls[0][0];
      expect(createCall.data.isCompany).toBe(false);
    });
  });

  describe('update', () => {
    it('should update client and trigger RAG upsert', async () => {
      const existingClient = { id: '1', name: 'Juan', companyId };
      const updated = { id: '1', name: 'Juan Carlos', companyId };

      mockPrisma.client.findFirst.mockResolvedValue(existingClient);
      mockPrisma.client.update.mockResolvedValue(updated);

      const result = await service.update('1', companyId, { name: 'Juan Carlos' });

      expect(result.name).toBe('Juan Carlos');
      expect(mockRag.upsertEmbedding).toHaveBeenCalled();
    });

    it('should throw NotFoundException if client does not exist', async () => {
      mockPrisma.client.findFirst.mockResolvedValue(null);

      await expect(service.update('999', companyId, { name: 'X' })).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should soft delete client without pets', async () => {
      const client = { id: '1', name: 'Juan', companyId };
      mockPrisma.client.findFirst.mockResolvedValue(client);
      mockPrisma.pet.count.mockResolvedValue(0);
      mockPrisma.client.update.mockResolvedValue({ ...client, isDeleted: true });

      await service.remove('1', companyId);

      expect(mockPrisma.client.update).toHaveBeenCalledWith({
        where: { id: '1' },
        data: expect.objectContaining({ isDeleted: true }),
      });
      expect(mockRag.deleteEmbedding).toHaveBeenCalledWith(
        companyId,
        { source: 'client', clientId: '1' },
      );
    });

    it('should throw BadRequestException if client has pets', async () => {
      const client = { id: '1', name: 'Juan', companyId };
      mockPrisma.client.findFirst.mockResolvedValue(client);
      mockPrisma.pet.count.mockResolvedValue(3);

      await expect(service.remove('1', companyId)).rejects.toThrow(BadRequestException);
      await expect(service.remove('1', companyId)).rejects.toThrow('El cliente tiene mascotas asociadas');
    });

    it('should throw NotFoundException if client does not exist', async () => {
      mockPrisma.client.findFirst.mockResolvedValue(null);

      await expect(service.remove('999', companyId)).rejects.toThrow(NotFoundException);
    });
  });

  describe('getPets', () => {
    it('should return non-deleted pets for client', async () => {
      const pets = [
        { id: '1', name: 'Rex', isDeleted: false },
        { id: '2', name: 'Max', isDeleted: true },
      ];
      mockPrisma.pet.findMany.mockResolvedValue(pets);

      const result = await service.getPets('1', companyId);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Rex');
    });
  });

  describe('getPayments', () => {
    it('should return non-deleted payments for client', async () => {
      const payments = [
        { id: '1', total: 1000, isDeleted: false },
        { id: '2', total: 500, isDeleted: true },
      ];
      mockPrisma.payment.findMany.mockResolvedValue(payments);

      const result = await service.getPayments('1', companyId);

      expect(result).toHaveLength(1);
      expect(result[0].total).toBe(1000);
    });
  });

  describe('getDebts', () => {
    it('should return non-deleted debts for client', async () => {
      const debts = [
        { id: '1', amount: 2000, isDeleted: false },
      ];
      mockPrisma.debt.findMany.mockResolvedValue(debts);

      const result = await service.getDebts('1', companyId);

      expect(result).toHaveLength(1);
      expect(result[0].amount).toBe(2000);
    });
  });
});
