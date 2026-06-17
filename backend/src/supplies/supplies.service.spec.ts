import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SuppliesService } from './supplies.service';

class MockWorkbook {
  xlsx = { load: vi.fn().mockResolvedValue(undefined) };
  getWorksheet = vi.fn();
}

vi.mock('exceljs', () => ({
  Workbook: MockWorkbook,
}));

describe('SuppliesService', () => {
  let service: SuppliesService;
  let mockPrisma: any;
  let mockRag: any;
  let mockCloudinary: any;
  let mockEvents: any;
  let mockWorkbook: MockWorkbook;

  const companyId = 'company-1';

  beforeEach(() => {
    mockPrisma = {
      supply: {
        findFirst: vi.fn(),
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        count: vi.fn(),
        findMany: vi.fn(),
      },
      $transaction: vi.fn(),
      company: { findUnique: vi.fn() },
      document: { create: vi.fn() },
    };
    mockRag = { upsertEmbedding: vi.fn(), deleteEmbedding: vi.fn() };
    mockCloudinary = { getClient: vi.fn().mockReturnValue({ uploader: { upload: vi.fn() } }) };
    mockEvents = { emitToCompany: vi.fn() };
    mockWorkbook = new MockWorkbook();

    service = new SuppliesService(
      mockPrisma,
      mockCloudinary,
      mockEvents,
      mockRag,
    );
  });

  describe('importFromExcel', () => {
    it('should call rag.upsertEmbedding for each imported row', async () => {
      const row2 = { getCell: vi.fn((col) => ({ text: col === 1 ? 'Jeringa 10ml' : '', value: col >= 7 ? 10 : undefined })) };
      const row3 = { getCell: vi.fn((col) => ({ text: col === 1 ? 'Guantes latex' : '', value: col >= 7 ? 50 : undefined })) };
      const emptyRow = { getCell: vi.fn(() => ({ text: '', value: undefined })) };

      mockWorkbook.getWorksheet.mockReturnValue({
        rowCount: 3,
        getRow: vi.fn((rowNum) => {
          if (rowNum === 2) return row2;
          if (rowNum === 3) return row3;
          return emptyRow;
        }),
      });

      mockPrisma.supply.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);

      mockPrisma.supply.create
        .mockResolvedValueOnce({ id: 'supply-1', name: 'Jeringa 10ml', brand: 'BD', quantity: 10, unit: 'unidades', unitPrice: 50, minQuantity: 5 })
        .mockResolvedValueOnce({ id: 'supply-2', name: 'Guantes latex', brand: 'Ansell', quantity: 50, unit: 'cajas', unitPrice: 200, minQuantity: 10 });

      mockPrisma.supply.findUnique
        .mockResolvedValueOnce({ id: 'supply-1', name: 'Jeringa 10ml', brand: 'BD', quantity: 10, unit: 'unidades', unitPrice: 50, minQuantity: 5 })
        .mockResolvedValueOnce({ id: 'supply-2', name: 'Guantes latex', brand: 'Ansell', quantity: 50, unit: 'cajas', unitPrice: 200, minQuantity: 10 });

      const buffer = Buffer.from('fake excel content');
      const result = await service.importFromExcel(companyId, buffer);

      expect(result.imported).toBe(2);
      expect(mockRag.upsertEmbedding).toHaveBeenCalledTimes(2);

      expect(mockRag.upsertEmbedding).toHaveBeenNthCalledWith(1, companyId,
        'Jeringa 10ml | marca BD | stock 10 unidades | precio $50 | stock min 5',
        { source: 'supply', supplyId: 'supply-1', name: 'Jeringa 10ml', quantity: 10 }
      );

      expect(mockRag.upsertEmbedding).toHaveBeenNthCalledWith(2, companyId,
        'Guantes latex | marca Ansell | stock 50 cajas | precio $200 | stock min 10',
        { source: 'supply', supplyId: 'supply-2', name: 'Guantes latex', quantity: 50 }
      );
    });

    it('should call rag.upsertEmbedding when updating existing supply', async () => {
      const row2 = { getCell: vi.fn((col) => ({ text: col === 1 ? 'Jeringa 10ml' : '', value: col >= 7 ? 20 : undefined })) };
      const emptyRow = { getCell: vi.fn(() => ({ text: '', value: undefined })) };

      mockWorkbook.getWorksheet.mockReturnValue({
        rowCount: 2,
        getRow: vi.fn((rowNum) => {
          if (rowNum === 2) return row2;
          return emptyRow;
        }),
      });

      mockPrisma.supply.findFirst.mockResolvedValue({ id: 'supply-1', name: 'Jeringa 10ml' });
      mockPrisma.supply.update.mockResolvedValue({});
      mockPrisma.supply.findUnique.mockResolvedValue({ id: 'supply-1', name: 'Jeringa 10ml', brand: 'BD', quantity: 20, unit: 'unidades', unitPrice: 50, minQuantity: 5 });

      const buffer = Buffer.from('fake excel content');
      const result = await service.importFromExcel(companyId, buffer);

      expect(result.imported).toBe(1);
      expect(mockRag.upsertEmbedding).toHaveBeenCalledTimes(1);
      expect(mockRag.upsertEmbedding).toHaveBeenCalledWith(companyId,
        'Jeringa 10ml | marca BD | stock 20 unidades | precio $50 | stock min 5',
        { source: 'supply', supplyId: 'supply-1', name: 'Jeringa 10ml', quantity: 20 }
      );
    });
  });
});