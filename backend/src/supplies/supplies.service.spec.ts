import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SuppliesService } from './supplies.service';

const mockGetWorksheet = vi.fn();
const mockXlsxLoad = vi.fn().mockResolvedValue(undefined);

vi.mock('exceljs', () => {
  class MockWorkbook {
    xlsx = { load: mockXlsxLoad };
    getWorksheet = mockGetWorksheet;
  }
  return { Workbook: MockWorkbook };
});

describe('SuppliesService', () => {
  let service: SuppliesService;
  let mockPrisma: any;
  let mockRag: any;
  let mockCloudinary: any;
  let mockEvents: any;

  const companyId = 1;

  beforeEach(() => {
    mockGetWorksheet.mockReset();
    mockXlsxLoad.mockReset();
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

      mockGetWorksheet.mockReturnValue({
        rowCount: 3,
        getRow: vi.fn((rowNum) => {
          if (rowNum === 2) return row2;
          if (rowNum === 3) return row3;
          return emptyRow;
        }),
      });

      const supply1 = { id: 'supply-1', name: 'Jeringa 10ml', brand: 'BD', quantity: 10, unit: 'unidades', unitPrice: 50, minQuantity: 5 };
      const supply2 = { id: 'supply-2', name: 'Guantes latex', brand: 'Ansell', quantity: 50, unit: 'cajas', unitPrice: 200, minQuantity: 10 };

      // findFirst order: existence check Jeringa → get-after-create Jeringa → existence check Guantes → get-after-create Guantes
      mockPrisma.supply.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(supply1)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(supply2);

      mockPrisma.supply.create
        .mockResolvedValueOnce(supply1)
        .mockResolvedValueOnce(supply2);

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

      mockGetWorksheet.mockReturnValue({
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