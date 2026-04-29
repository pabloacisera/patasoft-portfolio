import { Injectable, NotFoundException, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { EventsGateway } from '../events/events.gateway';
import * as ExcelJS from 'exceljs';
import { DocumentType } from '@prisma/client';

@Injectable()
export class SuppliesService {
  private readonly logger = new Logger(SuppliesService.name);
  constructor(
    private prisma: PrismaService,
    private cloudinary: CloudinaryService,
    private events: EventsGateway,
  ) {}

  async findAll(companyId: string, q: any = {}) {
    const { page = 1, limit = 20, search, category, lowStock } = q;
    const skip = (Number(page) - 1) * Number(limit);
    const where: any = { 
      companyId, 
      ...(search && { name: { contains: search, mode: 'insensitive' } }), 
      ...(category && { category }) 
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.supply.findMany({ 
        where, 
        skip, 
        take: Number(limit), 
        orderBy: { name: 'asc' } 
      }),
      this.prisma.supply.count({ where }),
    ]);

    let filtered = data;
    if (lowStock === 'true') {
      filtered = data.filter(s => {
        const threshold = s.minQuantity ?? Math.ceil((s.initialQty || 0) * 0.1);
        return s.quantity <= threshold;
      });
    }

    return { 
      data: filtered, 
      meta: { 
        total, 
        page: Number(page), 
        limit: Number(limit), 
        totalPages: Math.ceil(total / Number(limit)) 
      } 
    };
  }

  async findOne(id: string, companyId: string) {
    const s = await this.prisma.supply.findFirst({ where: { id, companyId } });
    if (!s) throw new NotFoundException('Insumo no encontrado');
    return s;
  }

  async create(companyId: string, dto: any) {
    const supply = await this.prisma.supply.create({
      data: { 
        companyId, 
        name: dto.name, 
        brand: dto.brand, 
        category: dto.category, 
        unit: dto.unit, 
        stockUnit: dto.stockUnit || null,
        unitsPerStock: dto.unitsPerStock ? Number(dto.unitsPerStock) : null,
        dispensingUnit: dto.dispensingUnit || null,
        salePrice: dto.salePrice ? Number(dto.salePrice) : null,
        quantity: dto.quantity || 0, 
        minQuantity: dto.minQuantity, 
        initialQty: dto.quantity, 
        unitPrice: dto.unitPrice || 0, 
        description: dto.description,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
      },
    });
    this.logger.log(`Insumo creado: ${supply.name}`);
    return supply;
  }

  async update(id: string, companyId: string, dto: any) {
    await this.findOne(id, companyId);
    return this.prisma.supply.update({ 
      where: { id }, 
      data: {
        ...dto,
        ...(dto.expiresAt && { expiresAt: new Date(dto.expiresAt) })
      } 
    });
  }

  async remove(id: string, companyId: string) {
    await this.findOne(id, companyId);
    await this.prisma.supply.update({
      where: { id },
      data: { isDeleted: true, deletedAt: new Date() },
    });
    this.logger.log(`Insumo eliminado (soft): ${id}`);
  }

  async decreaseStock(id: string, companyId: string, qty: number, dispensingQty?: number) {
    const supply = await this.findOne(id, companyId);

    let stockToDiscount = qty;

    // Si vienen unidades de despacho Y el supply tiene configuración de unidades
    if (dispensingQty && supply.unitsPerStock && supply.unitsPerStock > 1) {
      // Calcular cuántas unidades de stock se consumen
      // Redondear hacia arriba: no podés usar menos de 1 unidad de stock
      stockToDiscount = Math.ceil(dispensingQty / supply.unitsPerStock);
    }

    const newQty = Math.max(0, supply.quantity - stockToDiscount);

    const updated = await this.prisma.supply.update({
      where: { id },
      data: { quantity: newQty }
    });

    const threshold = updated.minQuantity ?? Math.ceil((updated.initialQty || 0) * 0.1);
    if (updated.quantity <= threshold) {
      this.events.emitToCompany(companyId, 'stock:alert', {
        supplyId: updated.id,
        name: updated.name,
        quantity: updated.quantity,
        threshold
      });
    }

    return updated;
  }

  async getLowStock(companyId: string) {
    const supplies = await this.prisma.supply.findMany({
      where: { companyId, isActive: true }
    });

    return supplies.filter(s => {
      const threshold = s.minQuantity ?? Math.ceil((s.initialQty || 0) * 0.1);
      return s.quantity <= threshold;
    });
  }

  async downloadTemplate() {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Plantilla Insumos');
    
    sheet.columns = [
      { header: 'Nombre', key: 'name', width: 30 },
      { header: 'Marca', key: 'brand', width: 20 },
      { header: 'Categoría', key: 'category', width: 20 },
      { header: 'Unidad', key: 'unit', width: 10 },
      { header: 'Cantidad', key: 'quantity', width: 10 },
      { header: 'Precio Unitario', key: 'unitPrice', width: 15 },
      { header: 'Stock Mínimo', key: 'minQuantity', width: 15 },
      { header: 'Vencimiento (YYYY-MM-DD)', key: 'expiresAt', width: 25 },
    ];

    return workbook.xlsx.writeBuffer();
  }

  async exportExcel(companyId: string) {
    const company = await this.prisma.company.findUnique({ where: { id: companyId } });
    const supplies = await this.prisma.supply.findMany({
      where: { companyId },
      orderBy: { name: 'asc' }
    });

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Insumos');

    sheet.columns = [
      { header: 'ID', key: 'id', width: 15 },
      { header: 'Nombre', key: 'name', width: 30 },
      { header: 'Marca', key: 'brand', width: 20 },
      { header: 'Categoría', key: 'category', width: 20 },
      { header: 'Unidad', key: 'unit', width: 10 },
      { header: 'Cantidad Actual', key: 'quantity', width: 15 },
      { header: 'Stock Mínimo', key: 'minQuantity', width: 15 },
      { header: 'Precio Unitario', key: 'unitPrice', width: 15 },
    ];

    supplies.forEach(s => sheet.addRow(s));

    const buffer = await workbook.xlsx.writeBuffer() as unknown as Buffer;
    const folder = `patasoft/${company.slug}/supplies`;
    
    const upload = await this.cloudinary.getClient().uploader.upload(`data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${buffer.toString('base64')}`, {
      folder,
      resource_type: 'raw',
      public_id: `inventario_${new Date().getTime()}`,
      format: 'xlsx'
    });

    await this.prisma.document.create({
      data: {
        companyId,
        type: DocumentType.SUPPLY_EXCEL,
        name: `Inventario_${new Date().toLocaleDateString()}.xlsx`,
        cloudinaryUrl: upload.secure_url,
        cloudinaryId: upload.public_id,
        folder
      }
    });

    this.events.emitToCompany(companyId, 'document:ready', {
      type: 'SUPPLY_EXCEL',
      url: upload.secure_url
    });

    return { url: upload.secure_url };
  }

  async importFromExcel(companyId: string, buffer: Buffer | Uint8Array) {
    const workbook = new ExcelJS.Workbook();
    const bufferToUse = buffer instanceof Uint8Array ? Buffer.from(buffer) : buffer;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await workbook.xlsx.load(bufferToUse as any);
    const sheet = workbook.getWorksheet(1);
    
    const results = { imported: 0, errors: [] };

    for (let i = 2; i <= sheet.rowCount; i++) {
      const row = sheet.getRow(i);
      const name = row.getCell(1).text;
      if (!name) continue;

      try {
        const existing = await this.prisma.supply.findFirst({
          where: { name, companyId }
        });

        if (existing) {
          await this.prisma.supply.update({
            where: { id: existing.id },
            data: {
              brand: row.getCell(2).text || existing.brand,
              category: row.getCell(3).text || existing.category,
              unit: row.getCell(4).text || existing.unit,
              quantity: row.getCell(5).value !== null ? Number(row.getCell(5).value) : existing.quantity,
              unitPrice: row.getCell(6).value !== null ? Number(row.getCell(6).value) : existing.unitPrice,
              minQuantity: row.getCell(7).value !== null ? Number(row.getCell(7).value) : existing.minQuantity,
            }
          });
        } else {
          await this.prisma.supply.create({
            data: {
              companyId,
              name,
              brand: row.getCell(2).text,
              category: row.getCell(3).text,
              unit: row.getCell(4).text,
              quantity: Number(row.getCell(5).value) || 0,
              unitPrice: Number(row.getCell(6).value) || 0,
              minQuantity: Number(row.getCell(7).value) || null,
              initialQty: Number(row.getCell(5).value) || 0,
              expiresAt: row.getCell(8).value ? new Date(row.getCell(8).text) : null,
            }
          });
        }
        results.imported++;
      } catch (e) {
        results.errors.push(`Fila ${i}: ${e.message}`);
      }
    }

    return results;
  }
}