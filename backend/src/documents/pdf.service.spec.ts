import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as puppeteer from 'puppeteer';
import { PdfService } from './pdf.service';

vi.mock('fs', () => ({
  readFileSync: vi.fn().mockReturnValue('<html><body>{{companyName}}</body></html>'),
  existsSync: vi.fn().mockReturnValue(true),
}));

vi.mock('puppeteer', () => ({
  launch: vi.fn(),
}));

describe('PdfService', () => {
  let service: PdfService;
  let mockPrisma: any;
  let mockCloudinary: any;
  let mockBrowser: any;
  let mockPage: any;

  beforeEach(() => {
    mockPage = {
      setContent: vi.fn().mockResolvedValue(undefined),
      pdf: vi.fn().mockResolvedValue(Buffer.from('pdf-buffer')),
      close: vi.fn().mockResolvedValue(undefined),
    };
    mockBrowser = {
      isConnected: vi.fn().mockReturnValue(true),
      pages: vi.fn().mockResolvedValue([]),
      newPage: vi.fn().mockResolvedValue(mockPage),
      close: vi.fn().mockResolvedValue(undefined),
    };
    mockPrisma = {
      payment: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'pay-1',
          createdAt: new Date('2026-01-01T00:00:00Z'),
          totalAmount: 5000,
          method: 'CASH',
          status: 'PAID',
          client: { name: 'Juan', lastName: 'Perez' },
          items: [
            { description: 'Consulta', quantity: 1, unitPrice: 5000, totalPrice: 5000 },
          ],
        }),
      },
      company: {
        findUnique: vi.fn().mockResolvedValue({
          name: 'PataSoft',
          address: 'Calle 123',
          phone: '123456',
        }),
      },
    };
    mockCloudinary = {
      getClient: vi.fn(),
    };
    (puppeteer.launch as any).mockResolvedValue(mockBrowser);
    service = new PdfService(mockPrisma, mockCloudinary);
  });

  it('reuses the same browser instance for sequential PDF generation', async () => {
    const first = await service.generateReceipt('pay-1', 'company-1');
    const second = await service.generateReceipt('pay-1', 'company-1');

    expect(first).toBeInstanceOf(Buffer);
    expect(second).toBeInstanceOf(Buffer);
    expect(puppeteer.launch).toHaveBeenCalledTimes(1);
    expect(mockBrowser.newPage).toHaveBeenCalledTimes(2);
    expect(mockPage.setContent).toHaveBeenCalledTimes(2);
  });
});
