import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { MedicalRecordsService } from './medical-records.service';

describe('MedicalRecordsService', () => {
  let service: MedicalRecordsService;
  let mockPrisma: any;
  let mockPdfService: any;
  let mockRag: any;
  let mockCashService: any;
  let mockDocumentProcessor: any;

  const companyId = 'company-1';

  beforeEach(() => {
    const mockTx = {
      medicalRecord: { create: vi.fn() },
      supply: { findUnique: vi.fn(), update: vi.fn() },
      payment: { create: vi.fn() },
    };

    mockPrisma = {
      pet: {
        findMany: vi.fn().mockResolvedValue([]),
        findFirst: vi.fn().mockResolvedValue(null),
      },
      medicalRecord: {
        findMany: vi.fn().mockResolvedValue([]),
        findFirst: vi.fn().mockResolvedValue(null),
        count: vi.fn().mockResolvedValue(0),
        create: vi.fn(),
        update: vi.fn(),
      },
      priceItem: {
        findUnique: vi.fn().mockResolvedValue(null),
      },
      supply: {
        findUnique: vi.fn().mockResolvedValue(null),
        findFirst: vi.fn().mockResolvedValue(null),
        update: vi.fn(),
      },
      procedure: {
        create: vi.fn(),
      },
      prescription: {
        create: vi.fn(),
      },
      document: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
      $transaction: vi.fn().mockImplementation(async (fnOrQueries) => {
        if (typeof fnOrQueries === 'function') {
          return fnOrQueries(mockTx);
        }
        return Promise.all(fnOrQueries);
      }),
      _tx: mockTx,
    };
    mockPdfService = {
      generateAndStorePrescription: vi.fn().mockResolvedValue({}),
      generateAndStoreReceipt: vi.fn().mockResolvedValue({}),
    };
    mockRag = {
      upsertEmbedding: vi.fn().mockResolvedValue(undefined),
      deleteEmbedding: vi.fn().mockResolvedValue(undefined),
    };
    mockCashService = {
      createFromPayment: vi.fn().mockResolvedValue({}),
    };
    mockDocumentProcessor = {
      enqueuePdfJob: vi.fn().mockResolvedValue('job-id'),
    };
    service = new MedicalRecordsService(mockPrisma, mockPdfService, mockRag, mockCashService, mockDocumentProcessor);
  });

  describe('findAll', () => {
    it('should return paginated records for company pets', async () => {
      const records = [{ id: '1', visitReason: 'Vacuna' }];
      mockPrisma.pet.findMany.mockResolvedValue([{ id: 'pet-1' }]);
      mockPrisma.medicalRecord.findMany.mockResolvedValue(records);
      mockPrisma.medicalRecord.count.mockResolvedValue(1);

      const result = await service.findAll(companyId, { page: 1, limit: 10 });

      expect(result.data).toEqual(records);
      expect(result.meta.total).toBe(1);
    });

    it('should filter by petId', async () => {
      mockPrisma.pet.findMany.mockResolvedValue([{ id: 'pet-1' }]);
      mockPrisma.medicalRecord.findMany.mockResolvedValue([]);
      mockPrisma.medicalRecord.count.mockResolvedValue(0);

      await service.findAll(companyId, { petId: 'pet-1' });

      const where = mockPrisma.medicalRecord.findMany.mock.calls[0][0].where;
      expect(where.petId).toBe('pet-1');
    });

    it('should filter by date range', async () => {
      mockPrisma.pet.findMany.mockResolvedValue([{ id: 'pet-1' }]);
      mockPrisma.medicalRecord.findMany.mockResolvedValue([]);
      mockPrisma.medicalRecord.count.mockResolvedValue(0);

      await service.findAll(companyId, { startDate: '2026-01-01', endDate: '2026-12-31' });

      const where = mockPrisma.medicalRecord.findMany.mock.calls[0][0].where;
      expect(where.date.gte).toBeInstanceOf(Date);
      expect(where.date.lte).toBeInstanceOf(Date);
    });

    it('should search across visitReason, diagnosis, treatment, observations', async () => {
      mockPrisma.pet.findMany.mockResolvedValue([{ id: 'pet-1' }]);
      mockPrisma.medicalRecord.findMany.mockResolvedValue([]);
      mockPrisma.medicalRecord.count.mockResolvedValue(0);

      await service.findAll(companyId, { search: 'vacuna' });

      const where = mockPrisma.medicalRecord.findMany.mock.calls[0][0].where;
      expect(where.OR).toHaveLength(4);
    });

    it('should always filter out deleted records', async () => {
      mockPrisma.pet.findMany.mockResolvedValue([]);
      mockPrisma.medicalRecord.findMany.mockResolvedValue([]);
      mockPrisma.medicalRecord.count.mockResolvedValue(0);

      await service.findAll(companyId);

      const where = mockPrisma.medicalRecord.findMany.mock.calls[0][0].where;
      expect(where.isDeleted).toBe(false);
    });
  });

  describe('findOne', () => {
    it('should return record with pet, procedures, prescriptions and payment', async () => {
      const record = { id: '1', petId: 'pet-1', pet: {}, procedures: [], prescriptions: [], payment: {} };
      mockPrisma.pet.findMany.mockResolvedValue([{ id: 'pet-1' }]);
      mockPrisma.medicalRecord.findFirst.mockResolvedValue(record);

      const result = await service.findOne('1', companyId);

      expect(result).toEqual(record);
    });

    it('should throw NotFoundException if record not found', async () => {
      mockPrisma.pet.findMany.mockResolvedValue([{ id: 'pet-1' }]);
      mockPrisma.medicalRecord.findFirst.mockResolvedValue(null);

      await expect(service.findOne('999', companyId)).rejects.toThrow(NotFoundException);
    });
  });

  describe('create (FLUJO CRÍTICO)', () => {
    const basePet = { id: 'pet-1', name: 'Rex', clientId: 'client-1', client: { id: 'client-1', name: 'Juan' } };

    it('should throw NotFoundException if pet not found', async () => {
      mockPrisma.pet.findFirst.mockResolvedValue(null);

      await expect(service.create(companyId, { petId: 'invalid', visitReason: 'Test' }))
        .rejects.toThrow(NotFoundException);
    });

    it('should create record with procedures and prescriptions in atomic transaction', async () => {
      const dto = {
        petId: 'pet-1',
        visitReason: 'Vacuna anual',
        diagnosis: 'Saludable',
        procedures: [{ name: 'Vacuna Rabia', quantity: 1 }],
        prescriptions: [{ medicineName: 'Antiparasitario', dose: '1ml' }],
      };

      const record = { id: 'rec-1', petId: 'pet-1', visitReason: dto.visitReason, date: new Date(), procedures: [], prescriptions: [] };
      const payment = { id: 'pay-1', totalAmount: 0, items: [] };

      mockPrisma.pet.findFirst.mockResolvedValue(basePet);
      mockPrisma._tx.medicalRecord.create.mockResolvedValue(record);
      mockPrisma._tx.payment.create.mockResolvedValue(payment);

      const result = await service.create(companyId, dto);

      expect(result.record).toEqual(record);
      expect(result.payment).toEqual(payment);
      expect(mockPrisma._tx.medicalRecord.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          petId: 'pet-1',
          visitReason: 'Vacuna anual',
          diagnosis: 'Saludable',
          procedures: { create: expect.any(Array) },
          prescriptions: { create: expect.any(Array) },
        }),
        include: { procedures: true, prescriptions: true },
      });
    });

    it('should calculate total from PriceItem when priceItemId is provided', async () => {
      const dto = {
        petId: 'pet-1',
        visitReason: 'Consulta',
        procedures: [{ name: 'Consulta', priceItemId: 'pi-1', quantity: 1 }],
      };

      mockPrisma.pet.findFirst.mockResolvedValue(basePet);
      mockPrisma.priceItem.findUnique.mockResolvedValue({ id: 'pi-1', price: 3000 });
      mockPrisma._tx.medicalRecord.create.mockResolvedValue({ id: 'rec-1', procedures: [], prescriptions: [] });
      mockPrisma._tx.payment.create.mockResolvedValue({ id: 'pay-1', totalAmount: 3000, items: [] });

      await service.create(companyId, dto);

      const paymentCall = mockPrisma._tx.payment.create.mock.calls[0][0];
      expect(paymentCall.data.totalAmount).toBe(3000);
    });

    it('should calculate total from Supply salePrice/unitsPerStock', async () => {
      const dto = {
        petId: 'pet-1',
        visitReason: 'Inyección',
        procedures: [{ name: 'Inyección', supplyId: 'sup-1', quantity: 2 }],
      };

      mockPrisma.pet.findFirst.mockResolvedValue(basePet);
      mockPrisma.supply.findUnique.mockResolvedValue({ id: 'sup-1', salePrice: 1000, unitsPerStock: 2 });
      mockPrisma._tx.medicalRecord.create.mockResolvedValue({ id: 'rec-1', procedures: [], prescriptions: [] });
      mockPrisma._tx.supply.findUnique.mockResolvedValue({ id: 'sup-1', quantity: 10 });
      mockPrisma._tx.supply.update.mockResolvedValue({});
      mockPrisma._tx.payment.create.mockResolvedValue({ id: 'pay-1', totalAmount: 1000, items: [] });

      await service.create(companyId, dto);

      const paymentCall = mockPrisma._tx.payment.create.mock.calls[0][0];
      expect(paymentCall.data.totalAmount).toBe(1000);
    });

    it('should discount stock for procedures with supplyId', async () => {
      const dto = {
        petId: 'pet-1',
        visitReason: 'Inyección',
        procedures: [{ name: 'Inyección', supplyId: 'sup-1', quantity: 3 }],
      };

      mockPrisma.pet.findFirst.mockResolvedValue(basePet);
      mockPrisma.supply.findUnique.mockResolvedValue({ id: 'sup-1', salePrice: 500, unitsPerStock: 1 });
      mockPrisma._tx.medicalRecord.create.mockResolvedValue({ id: 'rec-1', procedures: [], prescriptions: [] });
      mockPrisma._tx.supply.findUnique.mockResolvedValue({ id: 'sup-1', quantity: 10 });
      mockPrisma._tx.supply.update.mockResolvedValue({});
      mockPrisma._tx.payment.create.mockResolvedValue({ id: 'pay-1', totalAmount: 1500, items: [] });

      await service.create(companyId, dto);

      expect(mockPrisma._tx.supply.update).toHaveBeenCalledWith({
        where: { id: 'sup-1' },
        data: { quantity: { decrement: 3 } },
      });
    });

    it('should discount stock for prescriptions soldInClinic', async () => {
      const dto = {
        petId: 'pet-1',
        visitReason: 'Consulta',
        prescriptions: [{ supplyId: 'sup-1', medicineName: 'Med', soldInClinic: true, quantity: 2 }],
      };

      mockPrisma.pet.findFirst.mockResolvedValue(basePet);
      mockPrisma.supply.findUnique.mockResolvedValue({ id: 'sup-1', salePrice: 800, unitsPerStock: 1 });
      mockPrisma._tx.medicalRecord.create.mockResolvedValue({ id: 'rec-1', procedures: [], prescriptions: [] });
      mockPrisma._tx.supply.findUnique.mockResolvedValue({ id: 'sup-1', quantity: 10 });
      mockPrisma._tx.supply.update.mockResolvedValue({});
      mockPrisma._tx.payment.create.mockResolvedValue({ id: 'pay-1', totalAmount: 1600, items: [] });

      await service.create(companyId, dto);

      expect(mockPrisma._tx.supply.update).toHaveBeenCalledWith({
        where: { id: 'sup-1' },
        data: { quantity: { decrement: 2 } },
      });
    });

    it('should create cash movement for CASH payment', async () => {
      const dto = {
        petId: 'pet-1',
        visitReason: 'Consulta',
        totalAmount: 5000,
        paymentMethod: 'CASH',
        paymentStatus: 'PAID',
      };

      mockPrisma.pet.findFirst.mockResolvedValue(basePet);
      mockPrisma._tx.medicalRecord.create.mockResolvedValue({ id: 'rec-1', procedures: [], prescriptions: [] });
      mockPrisma._tx.payment.create.mockResolvedValue({ id: 'pay-1', totalAmount: 5000, items: [] });

      await service.create(companyId, dto);

      expect(mockCashService.createFromPayment).toHaveBeenCalledWith(companyId, 'pay-1', 5000);
    });

    it('should NOT create cash movement for non-CASH payment', async () => {
      const dto = {
        petId: 'pet-1',
        visitReason: 'Consulta',
        totalAmount: 5000,
        paymentMethod: 'TRANSFER',
        paymentStatus: 'PAID',
      };

      mockPrisma.pet.findFirst.mockResolvedValue(basePet);
      mockPrisma._tx.medicalRecord.create.mockResolvedValue({ id: 'rec-1', procedures: [], prescriptions: [] });
      mockPrisma._tx.payment.create.mockResolvedValue({ id: 'pay-1', totalAmount: 5000, items: [] });

      await service.create(companyId, dto);

      expect(mockCashService.createFromPayment).not.toHaveBeenCalled();
    });

    it('should trigger RAG upsert after creation', async () => {
      const dto = { petId: 'pet-1', visitReason: 'Vacuna', diagnosis: 'OK' };

      mockPrisma.pet.findFirst.mockResolvedValue(basePet);
      mockPrisma._tx.medicalRecord.create.mockResolvedValue({ id: 'rec-1', date: new Date(), visitReason: 'Vacuna', diagnosis: 'OK', procedures: [], prescriptions: [] });
      mockPrisma._tx.payment.create.mockResolvedValue({ id: 'pay-1', totalAmount: 0, items: [] });

      await service.create(companyId, dto);

      expect(mockRag.upsertEmbedding).toHaveBeenCalledWith(
        companyId,
        expect.stringContaining('Historia médica de Rex'),
        expect.objectContaining({ source: 'medicalrecord', recordId: 'rec-1', petId: 'pet-1' }),
      );
    });

    it('should use dto.totalAmount when provided directly', async () => {
      const dto = { petId: 'pet-1', visitReason: 'Consulta', totalAmount: 7500 };

      mockPrisma.pet.findFirst.mockResolvedValue(basePet);
      mockPrisma._tx.medicalRecord.create.mockResolvedValue({ id: 'rec-1', procedures: [], prescriptions: [] });
      mockPrisma._tx.payment.create.mockResolvedValue({ id: 'pay-1', totalAmount: 7500, items: [] });

      await service.create(companyId, dto);

      const paymentCall = mockPrisma._tx.payment.create.mock.calls[0][0];
      expect(paymentCall.data.totalAmount).toBe(7500);
    });
  });

  describe('update', () => {
    it('should update record and trigger RAG upsert', async () => {
      const existingRecord = { id: '1', petId: 'pet-1', pet: { name: 'Rex' }, procedures: [], prescriptions: [] };
      const updated = { ...existingRecord, diagnosis: 'Updated' };

      mockPrisma.pet.findMany.mockResolvedValue([{ id: 'pet-1' }]);
      mockPrisma.medicalRecord.findFirst.mockResolvedValue(existingRecord);
      mockPrisma.medicalRecord.update.mockResolvedValue(updated);

      const result = await service.update('1', companyId, { diagnosis: 'Updated' });

      expect(result.diagnosis).toBe('Updated');
      expect(mockRag.upsertEmbedding).toHaveBeenCalled();
    });

    it('should throw NotFoundException if record not found', async () => {
      mockPrisma.pet.findMany.mockResolvedValue([{ id: 'pet-1' }]);
      mockPrisma.medicalRecord.findFirst.mockResolvedValue(null);

      await expect(service.update('999', companyId, { diagnosis: 'X' })).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should soft delete record and trigger RAG delete', async () => {
      const record = { id: '1', petId: 'pet-1', pet: {}, procedures: [], prescriptions: [], payment: {} };
      mockPrisma.pet.findMany.mockResolvedValue([{ id: 'pet-1' }]);
      mockPrisma.medicalRecord.findFirst.mockResolvedValue(record);
      mockPrisma.medicalRecord.update.mockResolvedValue({ ...record, isDeleted: true });

      await service.remove('1', companyId);

      expect(mockPrisma.medicalRecord.update).toHaveBeenCalledWith({
        where: { id: '1' },
        data: expect.objectContaining({ isDeleted: true }),
      });
      expect(mockRag.deleteEmbedding).toHaveBeenCalledWith(
        companyId,
        { source: 'medicalrecord', recordId: '1' },
      );
    });
  });

  describe('addProcedure', () => {
    it('should add procedure and discount stock if supplyId', async () => {
      const record = { id: 'rec-1', petId: 'pet-1', pet: {}, procedures: [], prescriptions: [], payment: {} };
      mockPrisma.pet.findMany.mockResolvedValue([{ id: 'pet-1' }]);
      mockPrisma.medicalRecord.findFirst.mockResolvedValue(record);
      mockPrisma.procedure.create.mockResolvedValue({ id: 'proc-1', name: 'Vacuna' });
      mockPrisma.supply.findFirst.mockResolvedValue({ id: 'sup-1', name: 'Vacuna', quantity: 10 });
      mockPrisma.supply.update.mockResolvedValue({});

      await service.addProcedure('rec-1', companyId, { name: 'Vacuna', supplyId: 'sup-1', quantity: 2 });

      expect(mockPrisma.procedure.create).toHaveBeenCalled();
      expect(mockPrisma.supply.update).toHaveBeenCalledWith({
        where: { id: 'sup-1' },
        data: { quantity: 8 },
      });
    });
  });

  describe('addPrescription', () => {
    it('should add prescription to record', async () => {
      const record = { id: 'rec-1', petId: 'pet-1', pet: {}, procedures: [], prescriptions: [], payment: {} };
      mockPrisma.pet.findMany.mockResolvedValue([{ id: 'pet-1' }]);
      mockPrisma.medicalRecord.findFirst.mockResolvedValue(record);
      mockPrisma.prescription.create.mockResolvedValue({ id: 'pres-1', medicineName: 'Amoxicilina' });

      const result = await service.addPrescription('rec-1', companyId, { medicineName: 'Amoxicilina', dose: '5ml' });

      expect(result.medicineName).toBe('Amoxicilina');
    });
  });
});
