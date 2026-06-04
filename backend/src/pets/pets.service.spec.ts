import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { PetsService } from './pets.service';

describe('PetsService', () => {
  let service: PetsService;
  let mockPrisma: any;
  let mockCloudinary: any;
  let mockRag: any;

  const companyId = 'company-1';

  beforeEach(() => {
    mockPrisma = {
      pet: {
        findMany: vi.fn().mockResolvedValue([]),
        findFirst: vi.fn().mockResolvedValue(null),
        count: vi.fn().mockResolvedValue(0),
        create: vi.fn(),
        update: vi.fn(),
      },
      petPhoto: {
        count: vi.fn().mockResolvedValue(0),
        create: vi.fn(),
        findFirst: vi.fn().mockResolvedValue(null),
        delete: vi.fn(),
      },
      client: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
      medicalRecord: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      $transaction: vi.fn().mockImplementation(async (queries) => {
        return Promise.all(queries);
      }),
    };
    mockCloudinary = {
      getClient: vi.fn().mockReturnValue({
        uploader: { upload: vi.fn().mockResolvedValue({ secure_url: 'https://cloudinary.com/photo.jpg', public_id: 'photo-1' }) },
      }),
      deleteImage: vi.fn().mockResolvedValue(undefined),
    };
    mockRag = {
      upsertEmbedding: vi.fn().mockResolvedValue(undefined),
      deleteEmbedding: vi.fn().mockResolvedValue(undefined),
    };
    service = new PetsService(mockPrisma, mockCloudinary, mockRag);
  });

  describe('findAll', () => {
    it('should return paginated pets for company', async () => {
      const pets = [{ id: '1', name: 'Rex', isDeleted: false }];
      mockPrisma.pet.findMany.mockResolvedValue(pets);
      mockPrisma.pet.count.mockResolvedValue(1);

      const result = await service.findAll(companyId, { page: 1, limit: 10 });

      expect(result.data).toEqual(pets);
      expect(result.meta.total).toBe(1);
    });

    it('should filter by search term across name and breed', async () => {
      mockPrisma.pet.findMany.mockResolvedValue([]);
      mockPrisma.pet.count.mockResolvedValue(0);

      await service.findAll(companyId, { search: 'rex' });

      const where = mockPrisma.pet.findMany.mock.calls[0][0].where;
      expect(where.OR).toHaveLength(2);
      expect(where.OR[0]).toEqual({ name: { contains: 'rex', mode: 'insensitive' } });
      expect(where.OR[1]).toEqual({ breed: { contains: 'rex', mode: 'insensitive' } });
    });

    it('should filter by species', async () => {
      mockPrisma.pet.findMany.mockResolvedValue([]);
      mockPrisma.pet.count.mockResolvedValue(0);

      await service.findAll(companyId, { species: 'dog' });

      const where = mockPrisma.pet.findMany.mock.calls[0][0].where;
      expect(where.species).toBe('dog');
    });

    it('should always filter out deleted pets', async () => {
      mockPrisma.pet.findMany.mockResolvedValue([]);
      mockPrisma.pet.count.mockResolvedValue(0);

      await service.findAll(companyId);

      const where = mockPrisma.pet.findMany.mock.calls[0][0].where;
      expect(where.isDeleted).toBe(false);
    });
  });

  describe('findOne', () => {
    it('should return pet with client, photos, medicalRecords and payments', async () => {
      const pet = { id: '1', name: 'Rex', companyId, client: {}, photos: [], medicalRecords: [], payments: [] };
      mockPrisma.pet.findFirst.mockResolvedValue(pet);

      const result = await service.findOne('1', companyId);

      expect(result).toEqual(pet);
      expect(mockPrisma.pet.findFirst).toHaveBeenCalledWith({
        where: { id: '1', companyId },
        include: {
          client: true,
          photos: true,
          medicalRecords: { orderBy: { date: 'desc' }, take: 20 },
          payments: { orderBy: { createdAt: 'desc' }, take: 10 },
        },
      });
    });

    it('should throw NotFoundException if pet not found', async () => {
      mockPrisma.pet.findFirst.mockResolvedValue(null);

      await expect(service.findOne('999', companyId)).rejects.toThrow(NotFoundException);
      await expect(service.findOne('999', companyId)).rejects.toThrow('Mascota no encontrada');
    });
  });

  describe('create', () => {
    it('should create pet and trigger RAG upsert', async () => {
      const dto = { name: 'Rex', species: 'dog', breed: 'Labrador', clientId: 'client-1' };
      const pet = { id: '1', companyId, client: { name: 'Juan' }, photos: [], ...dto };

      mockPrisma.client.findFirst.mockResolvedValue({ id: 'client-1', name: 'Juan' });
      mockPrisma.pet.create.mockResolvedValue(pet);

      const result = await service.create(companyId, dto);

      expect(result.name).toBe('Rex');
      expect(mockRag.upsertEmbedding).toHaveBeenCalledWith(
        companyId,
        expect.stringContaining('Mascota Rex'),
        expect.objectContaining({ source: 'pet', petId: '1' }),
      );
    });

    it('should throw BadRequestException if client not found', async () => {
      mockPrisma.client.findFirst.mockResolvedValue(null);

      await expect(service.create(companyId, { name: 'Rex', species: 'dog', clientId: 'invalid' }))
        .rejects.toThrow(BadRequestException);
    });

    it('should default isNeutered to false', async () => {
      const dto = { name: 'Rex', species: 'dog' };
      mockPrisma.pet.create.mockResolvedValue({ id: '1', companyId, client: null, ...dto });

      await service.create(companyId, dto);

      const createCall = mockPrisma.pet.create.mock.calls[0][0];
      expect(createCall.data.isNeutered).toBe(false);
    });

    it('should include age in RAG embedding when birthDate is provided', async () => {
      const dto = { name: 'Rex', species: 'dog', birthDate: '2020-01-01' };
      mockPrisma.pet.create.mockResolvedValue({ id: '1', companyId, client: null, ...dto, birthDate: new Date('2020-01-01') });

      await service.create(companyId, dto);

      const ragContent = mockRag.upsertEmbedding.mock.calls[0][1];
      expect(ragContent).toContain('años');
    });
  });

  describe('update', () => {
    it('should update pet and trigger RAG upsert', async () => {
      const existingPet = { id: '1', name: 'Rex', companyId, client: null, photos: [] };
      const updated = { ...existingPet, name: 'Rexy' };

      mockPrisma.pet.findFirst.mockResolvedValue(existingPet);
      mockPrisma.pet.update.mockResolvedValue(updated);

      const result = await service.update('1', companyId, { name: 'Rexy' });

      expect(result.name).toBe('Rexy');
      expect(mockRag.upsertEmbedding).toHaveBeenCalled();
    });

    it('should throw NotFoundException if pet does not exist', async () => {
      mockPrisma.pet.findFirst.mockResolvedValue(null);

      await expect(service.update('999', companyId, { name: 'X' })).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should soft delete pet and trigger RAG delete', async () => {
      const pet = { id: '1', name: 'Rex', companyId, client: null, photos: [], medicalRecords: [], payments: [] };
      mockPrisma.pet.findFirst.mockResolvedValue(pet);
      mockPrisma.pet.update.mockResolvedValue({ ...pet, isDeleted: true });

      await service.remove('1', companyId);

      expect(mockPrisma.pet.update).toHaveBeenCalledWith({
        where: { id: '1' },
        data: expect.objectContaining({ isDeleted: true }),
      });
      expect(mockRag.deleteEmbedding).toHaveBeenCalledWith(
        companyId,
        { source: 'pet', petId: '1' },
      );
    });

    it('should throw NotFoundException if pet does not exist', async () => {
      mockPrisma.pet.findFirst.mockResolvedValue(null);

      await expect(service.remove('999', companyId)).rejects.toThrow(NotFoundException);
    });
  });

  describe('uploadPhoto', () => {
    it('should upload photo to Cloudinary and create PetPhoto', async () => {
      const pet = { id: '1', companyId, client: { name: 'Juan Perez' }, company: { slug: 'vet-test' } };
      mockPrisma.pet.findFirst.mockResolvedValue(pet);
      mockPrisma.petPhoto.count.mockResolvedValue(0);
      mockPrisma.petPhoto.create.mockResolvedValue({ id: 'photo-1', petId: '1', isPrimary: true });

      const result = await service.uploadPhoto('1', companyId, Buffer.from('test'), 'image/jpeg');

      expect(result.isPrimary).toBe(true);
      expect(mockCloudinary.getClient().uploader.upload).toHaveBeenCalledWith(
        expect.stringContaining('data:image/jpeg;base64'),
        expect.objectContaining({ folder: 'patasoft/vet-test/juan_perez', resource_type: 'image' }),
      );
    });

    it('should throw BadRequestException if pet already has 5 photos', async () => {
      const pet = { id: '1', companyId, client: null, company: { slug: 'vet-test' } };
      mockPrisma.pet.findFirst.mockResolvedValue(pet);
      mockPrisma.petPhoto.count.mockResolvedValue(5);

      await expect(service.uploadPhoto('1', companyId, Buffer.from('test'), 'image/jpeg'))
        .rejects.toThrow('Máximo 5 fotos por mascota');
    });

    it('should throw NotFoundException if pet not found', async () => {
      mockPrisma.pet.findFirst.mockResolvedValue(null);

      await expect(service.uploadPhoto('999', companyId, Buffer.from('test'), 'image/jpeg'))
        .rejects.toThrow(NotFoundException);
    });
  });

  describe('deletePhoto', () => {
    it('should delete photo from Cloudinary and DB', async () => {
      const pet = { id: '1', companyId, client: null, photos: [], medicalRecords: [], payments: [] };
      const photo = { id: 'photo-1', petId: '1', cloudinaryId: 'cloud-id' };

      mockPrisma.pet.findFirst.mockResolvedValue(pet);
      mockPrisma.petPhoto.findFirst.mockResolvedValue(photo);
      mockPrisma.petPhoto.delete.mockResolvedValue(photo);

      await service.deletePhoto('1', 'photo-1', companyId);

      expect(mockCloudinary.deleteImage).toHaveBeenCalledWith('cloud-id');
      expect(mockPrisma.petPhoto.delete).toHaveBeenCalledWith({ where: { id: 'photo-1' } });
    });

    it('should throw NotFoundException if photo not found', async () => {
      const pet = { id: '1', companyId, client: null, photos: [], medicalRecords: [], payments: [] };
      mockPrisma.pet.findFirst.mockResolvedValue(pet);
      mockPrisma.petPhoto.findFirst.mockResolvedValue(null);

      await expect(service.deletePhoto('1', 'invalid', companyId))
        .rejects.toThrow('Foto no encontrada');
    });
  });

  describe('getMedicalRecords', () => {
    it('should return non-deleted medical records for pet', async () => {
      const pet = { id: '1', companyId, client: null, photos: [], medicalRecords: [], payments: [] };
      const records = [
        { id: '1', isDeleted: false },
        { id: '2', isDeleted: true },
      ];

      mockPrisma.pet.findFirst.mockResolvedValue(pet);
      mockPrisma.medicalRecord.findMany.mockResolvedValue(records);

      const result = await service.getMedicalRecords('1', companyId);

      expect(result).toHaveLength(1);
      expect(result[0].isDeleted).toBe(false);
    });
  });
});
