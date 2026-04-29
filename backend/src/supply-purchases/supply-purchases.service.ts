import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as ExcelJS from 'exceljs';

@Injectable()
export class SupplyPurchasesService {
  private readonly logger = new Logger(SupplyPurchasesService.name);

  constructor(private prisma: PrismaService) {}

  async findAll(companyId: string, q: any = {}) {
    const { page = 1, limit = 20 } = q;
    const skip = (Number(page) - 1) * Number(limit);

    const [data, total] = await this.prisma.$transaction([
      this.prisma.supplyPurchase.findMany({
        where: { companyId },
        skip,
        take: Number(limit),
        orderBy: { purchasedAt: 'desc' },
        include: { supply: true },
      }),
      this.prisma.supplyPurchase.count({ where: { companyId } }),
    ]);

    return {
      data,
      meta: { total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(total / Number(limit)) },
    };
  }

  async create(companyId: string, dto: any) {
    const supply = await this.prisma.supply.findFirst({
      where: { id: dto.supplyId, companyId },
    });

    if (!supply) throw new NotFoundException('Insumo no encontrado');

    const totalCost = dto.quantity * dto.unitCost;

    const purchase = await this.prisma.supplyPurchase.create({
      data: {
        companyId,
        supplyId: dto.supplyId,
        quantity: dto.quantity,
        unitCost: dto.unitCost,
        totalCost,
        supplier: dto.supplier,
        invoiceNum: dto.invoiceNum,
        notes: dto.notes,
        purchasedAt: dto.purchasedAt ? new Date(dto.purchasedAt) : new Date(),
      },
      include: { supply: true },
    });

    await this.prisma.supply.update({
      where: { id: dto.supplyId },
      data: { quantity: { increment: dto.quantity } },
    });

    this.logger.log(`Compra registrada: ${purchase.id} - ${supply.name} +${dto.quantity}`);
    return purchase;
  }

  async exportExcel(companyId: string) {
    const purchases = await this.prisma.supplyPurchase.findMany({
      where: { companyId },
      orderBy: { purchasedAt: 'desc' },
      include: { supply: true },
    });

    const company = await this.prisma.company.findUnique({ where: { id: companyId } });

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Compras');

    worksheet.columns = [
      { header: 'Fecha', key: 'date', width: 15 },
      { header: 'Insumo', key: 'supply', width: 30 },
      { header: 'Cantidad', key: 'quantity', width: 10 },
      { header: 'Costo Unit.', key: 'unitCost', width: 15 },
      { header: 'Costo Total', key: 'totalCost', width: 15 },
      { header: 'Proveedor', key: 'supplier', width: 20 },
      { header: 'Factura', key: 'invoiceNum', width: 15 },
    ];

    purchases.forEach(p => {
      worksheet.addRow({
        date: p.purchasedAt.toLocaleDateString(),
        supply: p.supply.name,
        quantity: p.quantity,
        unitCost: p.unitCost,
        totalCost: p.totalCost,
        supplier: p.supplier || '',
        invoiceNum: p.invoiceNum || '',
      });
    });

    return workbook.xlsx.writeBuffer();
  }
}
