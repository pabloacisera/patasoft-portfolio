import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LocalRagService } from '../ai-proxy/local-rag.service';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { EventsGateway } from '../events/events.gateway';
import * as ExcelJS from 'exceljs';
import { DocumentType } from '@prisma/client';

@Injectable()
export class PriceItemsService {
  private readonly logger = new Logger(PriceItemsService.name);

  constructor(
    private prisma: PrismaService,
    private cloudinary: CloudinaryService,
    private events: EventsGateway,
    private rag: LocalRagService,
  ) {}

  async findAll(companyId: string, q: any = {}) {
    const { page = 1, limit = 20, search, category } = q;
    const skip = (Number(page) - 1) * Number(limit);
    
    const where: any = { companyId };
    
    if (search) {
      const searchNum = parseFloat(search);
      const searchConditions: any[] = [
        { name: { contains: search, mode: 'insensitive' } },
        { category: { contains: search, mode: 'insensitive' } },
      ];
      
      if (!isNaN(searchNum)) {
        searchConditions.push({ price: { equals: searchNum } });
      }
      
      where.OR = searchConditions;
    }
    
    if (category) {
      where.category = category;
    }

    const [data, total] = await this.prisma.$transaction([
      this.prisma.priceItem.findMany({ 
        where, 
        skip, 
        take: Number(limit), 
        orderBy: { name: 'asc' } 
      }),
      this.prisma.priceItem.count({ where }),
    ]);

    return { 
      data, 
      meta: { 
        total, 
        page: Number(page), 
        limit: Number(limit), 
        totalPages: Math.ceil(total / Number(limit)) 
      } 
    };
  }

  async findOne(id: string, companyId: string) {
    const item = await this.prisma.priceItem.findFirst({ where: { id, companyId } });
    if (!item) throw new NotFoundException('Item de precio no encontrado');
    return item;
  }

  async create(companyId: string, d: any) {
    const item = await this.prisma.priceItem.create({ 
      data: { 
        companyId, 
        name: d.name, 
        category: d.category, 
        price: d.price, 
        description: d.description 
      } 
    });

    this.rag.upsertEmbedding(companyId,
      `Precio: ${item.name}. Categoría: ${item.category || 'N/A'}. Precio: $${item.price}. Descripción: ${item.description || 'N/A'}.`,
      { source: 'price', priceId: item.id, name: item.name }
    );

    this.logger.log(`Precio creado: ${item.name} para company ${companyId}`);
    return item;
  }

  async update(id: string, companyId: string, d: any) {
    await this.findOne(id, companyId);
    const item = await this.prisma.priceItem.update({ where: { id }, data: d });

    this.rag.upsertEmbedding(companyId,
      `Precio: ${item.name}. Categoría: ${item.category || 'N/A'}. Precio: $${item.price}. Descripción: ${item.description || 'N/A'}.`,
      { source: 'price', priceId: item.id, name: item.name }
    );

    return item;
  }

  async remove(id: string, companyId: string) {
    await this.findOne(id, companyId);
    this.rag.deleteEmbedding(companyId, { source: 'price', priceId: id });
    return this.prisma.priceItem.delete({ where: { id } });
  }

  async downloadTemplate() {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Plantilla Precios');
    
    sheet.columns = [
      { header: 'Nombre', key: 'name', width: 30 },
      { header: 'Categoría', key: 'category', width: 20 },
      { header: 'Precio', key: 'price', width: 15 },
      { header: 'Descripción', key: 'description', width: 40 },
    ];

    return workbook.xlsx.writeBuffer();
  }

  async exportExcel(companyId: string) {
    const company = await this.prisma.company.findUnique({ where: { id: companyId } });
    const items = await this.prisma.priceItem.findMany({
      where: { companyId },
      orderBy: { category: 'asc' }
    });

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Lista de Precios');

    sheet.columns = [
      { header: 'Nombre', key: 'name', width: 30 },
      { header: 'Categoría', key: 'category', width: 20 },
      { header: 'Precio', key: 'price', width: 15 },
      { header: 'Descripción', key: 'description', width: 40 },
    ];

    items.forEach(item => sheet.addRow(item));

    const buffer = await workbook.xlsx.writeBuffer() as unknown as Buffer;
    const folder = `patasoft/${company.slug}/documents`;
    
    const upload = await this.cloudinary.getClient().uploader.upload(
      `data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${buffer.toString('base64')}`, 
      {
        folder,
        resource_type: 'raw',
        public_id: `precios_${new Date().getTime()}`,
        format: 'xlsx'
      }
    );

    await this.prisma.document.create({
      data: {
        companyId,
        type: DocumentType.PRICE_LIST,
        name: `Lista_Precios_${new Date().toLocaleDateString()}.xlsx`,
        cloudinaryUrl: upload.secure_url,
        cloudinaryId: upload.public_id,
        folder
      }
    });

    this.events.emitToCompany(companyId, 'document:ready', {
      type: 'PRICE_LIST_EXCEL',
      url: upload.secure_url
    });

    return { url: upload.secure_url };
  }

  async importFromExcel(companyId: string, buffer: Buffer | Uint8Array) {
    const workbook = new ExcelJS.Workbook();
    const bufferToUse = buffer instanceof Uint8Array ? Buffer.from(buffer) : buffer;
    await workbook.xlsx.load(bufferToUse as any);
    const sheet = workbook.getWorksheet(1);
    
    const results = { imported: 0, errors: [] };

    for (let i = 2; i <= sheet.rowCount; i++) {
      const row = sheet.getRow(i);
      const name = row.getCell(1).text;
      if (!name) continue;

      try {
        const existing = await this.prisma.priceItem.findFirst({
          where: { name, companyId }
        });

        const data = {
          name,
          category: row.getCell(2).text,
          price: Number(row.getCell(3).value) || 0,
          description: row.getCell(4).text,
        };

        if (existing) {
          await this.prisma.priceItem.update({ where: { id: existing.id }, data });
        } else {
          await this.prisma.priceItem.create({ data: { ...data, companyId } });
        }
        results.imported++;
      } catch (e) {
        results.errors.push(`Fila ${i}: ${e.message}`);
      }
    }

    return results;
  }
}
