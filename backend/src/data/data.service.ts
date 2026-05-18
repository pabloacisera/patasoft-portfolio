import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as ExcelJS from 'exceljs';

const DEFAULT_PAGE_SIZE = 50000;
const MAX_PAGE = 10;

@Injectable()
export class DataService {
  private readonly logger = new Logger(DataService.name);
  constructor(private prisma: PrismaService) {}

  async exportAll(companyId: string): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();

    await Promise.all([
      this.buildClientsSheet(workbook, companyId),
      this.buildPetsSheet(workbook, companyId),
      this.buildMedicalRecordsSheet(workbook, companyId),
      this.buildProceduresSheet(workbook, companyId),
      this.buildPrescriptionsSheet(workbook, companyId),
      this.buildPaymentsSheet(workbook, companyId),
      this.buildPaymentItemsSheet(workbook, companyId),
      this.buildDebtsSheet(workbook, companyId),
      this.buildSuppliesSheet(workbook, companyId),
      this.buildSupplyPurchasesSheet(workbook, companyId),
      this.buildCashMovementsSheet(workbook, companyId),
      this.buildPriceItemsSheet(workbook, companyId),
    ]);

    return (await workbook.xlsx.writeBuffer()) as unknown as Buffer;
  }

  private styleHeaderRow(worksheet: ExcelJS.Worksheet) {
    const header = worksheet.getRow(1);
    header.font = { bold: true, color: { argb: 'FFFFFF' } };
    header.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: '1B4332' },
    };
    header.alignment = { horizontal: 'center' };
    worksheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: worksheet.columnCount },
    };
  }

  private async buildClientsSheet(workbook: ExcelJS.Workbook, companyId: string) {
    const sheet = workbook.addWorksheet('Clientes');
    sheet.columns = [
      { header: 'ID', key: 'id', width: 28 },
      { header: 'Nombre', key: 'name', width: 22 },
      { header: 'Apellido', key: 'lastName', width: 22 },
      { header: 'DNI', key: 'dni', width: 15 },
      { header: 'CUIL', key: 'cuil', width: 15 },
      { header: 'Email', key: 'email', width: 30 },
      { header: 'Teléfono', key: 'phone', width: 18 },
      { header: 'Dirección', key: 'address', width: 30 },
      { header: 'Es Empresa', key: 'isCompany', width: 12 },
      { header: 'Empresa', key: 'companyName', width: 22 },
      { header: 'Notas', key: 'notes', width: 30 },
      { header: 'Creado', key: 'createdAt', width: 20 },
    ];
    const rows = await this.getAllPaginated(
      (page, take) =>
        this.prisma.client.findMany({
          where: { companyId, isDeleted: false },
          orderBy: { name: 'asc' },
          skip: (page - 1) * take,
          take,
        }),
    );
    rows.forEach((r) =>
      sheet.addRow({
        ...r,
        isCompany: r.isCompany ? 'Sí' : 'No',
        createdAt: r.createdAt?.toLocaleDateString(),
      }),
    );
    this.styleHeaderRow(sheet);
  }

  private async buildPetsSheet(workbook: ExcelJS.Workbook, companyId: string) {
    const sheet = workbook.addWorksheet('Mascotas');
    sheet.columns = [
      { header: 'ID', key: 'id', width: 28 },
      { header: 'Nombre', key: 'name', width: 22 },
      { header: 'Especie', key: 'species', width: 14 },
      { header: 'Raza', key: 'breed', width: 18 },
      { header: 'Sexo', key: 'gender', width: 8 },
      { header: 'Fecha Nac.', key: 'birthDate', width: 14 },
      { header: 'Peso (kg)', key: 'weight', width: 10 },
      { header: 'Color', key: 'color', width: 14 },
      { header: 'Microchip', key: 'microchipId', width: 18 },
      { header: 'Esterilizado', key: 'isNeutered', width: 12 },
      { header: 'Cliente', key: 'clientName', width: 26 },
      { header: 'Notas', key: 'notes', width: 30 },
      { header: 'Creado', key: 'createdAt', width: 20 },
    ];
    const rows = await this.getAllPaginated(
      (page, take) =>
        this.prisma.pet.findMany({
          where: { companyId, isDeleted: false },
          orderBy: { name: 'asc' },
          skip: (page - 1) * take,
          take,
          include: { client: { select: { name: true, lastName: true } } },
        }),
    );
    rows.forEach((r) =>
      sheet.addRow({
        id: r.id,
        name: r.name,
        species: r.species,
        breed: r.breed || '',
        gender: r.gender || '',
        birthDate: r.birthDate?.toLocaleDateString() || '',
        weight: r.weight ?? '',
        color: r.color || '',
        microchipId: r.microchipId || '',
        isNeutered: r.isNeutered ? 'Sí' : 'No',
        clientName: r.client ? `${r.client.name} ${r.client.lastName || ''}`.trim() : '',
        notes: r.notes || '',
        createdAt: r.createdAt?.toLocaleDateString() || '',
      }),
    );
    this.styleHeaderRow(sheet);
  }

  private async buildMedicalRecordsSheet(workbook: ExcelJS.Workbook, companyId: string) {
    const sheet = workbook.addWorksheet('Historiales Clínicos');
    sheet.columns = [
      { header: 'ID', key: 'id', width: 28 },
      { header: 'Fecha', key: 'date', width: 16 },
      { header: 'Mascota', key: 'petName', width: 22 },
      { header: 'Motivo', key: 'visitReason', width: 30 },
      { header: 'Diagnóstico', key: 'diagnosis', width: 30 },
      { header: 'Tratamiento', key: 'treatment', width: 30 },
      { header: 'Observaciones', key: 'observations', width: 30 },
      { header: 'Peso (kg)', key: 'weight', width: 10 },
      { header: 'Temperatura', key: 'temperature', width: 12 },
      { header: 'Próx. Visita', key: 'nextVisitDate', width: 16 },
      { header: 'Creado', key: 'createdAt', width: 20 },
    ];
    const rows = await this.getAllPaginated(
      (page, take) =>
        this.prisma.medicalRecord.findMany({
          where: { pet: { companyId }, isDeleted: false },
          orderBy: { date: 'desc' },
          skip: (page - 1) * take,
          take,
          include: { pet: { select: { name: true } } },
        }),
    );
    rows.forEach((r) =>
      sheet.addRow({
        id: r.id,
        date: r.date?.toLocaleDateString() || '',
        petName: r.pet.name,
        visitReason: r.visitReason,
        diagnosis: r.diagnosis || '',
        treatment: r.treatment || '',
        observations: r.observations || '',
        weight: r.weight ?? '',
        temperature: r.temperature ?? '',
        nextVisitDate: r.nextVisitDate?.toLocaleDateString() || '',
        createdAt: r.createdAt?.toLocaleDateString() || '',
      }),
    );
    this.styleHeaderRow(sheet);
  }

  private async buildProceduresSheet(workbook: ExcelJS.Workbook, companyId: string) {
    const sheet = workbook.addWorksheet('Procedimientos');
    sheet.columns = [
      { header: 'ID', key: 'id', width: 28 },
      { header: 'Historial ID', key: 'medicalRecordId', width: 28 },
      { header: 'Nombre', key: 'name', width: 26 },
      { header: 'Descripción', key: 'description', width: 30 },
      { header: 'Precio', key: 'customPrice', width: 12 },
      { header: 'Cantidad', key: 'quantity', width: 10 },
    ];
    const rows = await this.getAllPaginated(
      (page, take) =>
        this.prisma.procedure.findMany({
          where: { medicalRecord: { pet: { companyId }, isDeleted: false } },
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * take,
          take,
        }),
    );
    rows.forEach((r) =>
      sheet.addRow({
        id: r.id,
        medicalRecordId: r.medicalRecordId,
        name: r.name,
        description: r.description || '',
        customPrice: r.customPrice ?? '',
        quantity: r.quantity,
      }),
    );
    this.styleHeaderRow(sheet);
  }

  private async buildPrescriptionsSheet(workbook: ExcelJS.Workbook, companyId: string) {
    const sheet = workbook.addWorksheet('Prescripciones');
    sheet.columns = [
      { header: 'ID', key: 'id', width: 28 },
      { header: 'Historial ID', key: 'medicalRecordId', width: 28 },
      { header: 'Medicamento', key: 'medicineName', width: 26 },
      { header: 'Dosis', key: 'dose', width: 16 },
      { header: 'Frecuencia', key: 'frequency', width: 16 },
      { header: 'Duración', key: 'duration', width: 14 },
      { header: 'Cantidad', key: 'quantity', width: 10 },
      { header: 'Venta en Clínica', key: 'soldInClinic', width: 16 },
    ];
    const rows = await this.getAllPaginated(
      (page, take) =>
        this.prisma.prescription.findMany({
          where: { medicalRecord: { pet: { companyId }, isDeleted: false } },
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * take,
          take,
        }),
    );
    rows.forEach((r) =>
      sheet.addRow({
        id: r.id,
        medicalRecordId: r.medicalRecordId,
        medicineName: r.medicineName,
        dose: r.dose || '',
        frequency: r.frequency || '',
        duration: r.duration || '',
        quantity: r.quantity,
        soldInClinic: r.soldInClinic ? 'Sí' : 'No',
      }),
    );
    this.styleHeaderRow(sheet);
  }

  private async buildPaymentsSheet(workbook: ExcelJS.Workbook, companyId: string) {
    const sheet = workbook.addWorksheet('Pagos');
    sheet.columns = [
      { header: 'ID', key: 'id', width: 28 },
      { header: 'Fecha', key: 'createdAt', width: 16 },
      { header: 'Cliente', key: 'clientName', width: 26 },
      { header: 'Mascota', key: 'petName', width: 22 },
      { header: 'Total', key: 'totalAmount', width: 12 },
      { header: 'Pagado', key: 'paidAmount', width: 12 },
      { header: 'Método', key: 'method', width: 14 },
      { header: 'Estado', key: 'status', width: 12 },
      { header: 'Vencimiento', key: 'dueDate', width: 14 },
      { header: 'Notas', key: 'notes', width: 30 },
    ];
    const rows = await this.getAllPaginated(
      (page, take) =>
        this.prisma.payment.findMany({
          where: { companyId, isDeleted: false },
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * take,
          take,
          include: {
            client: { select: { name: true, lastName: true } },
            pet: { select: { name: true } },
          },
        }),
    );
    rows.forEach((r) =>
      sheet.addRow({
        id: r.id,
        createdAt: r.createdAt?.toLocaleDateString() || '',
        clientName: r.client ? `${r.client.name} ${r.client.lastName || ''}`.trim() : '',
        petName: r.pet?.name || '',
        totalAmount: r.totalAmount,
        paidAmount: r.paidAmount,
        method: r.method || '',
        status: r.status,
        dueDate: r.dueDate?.toLocaleDateString() || '',
        notes: r.notes || '',
      }),
    );
    this.styleHeaderRow(sheet);
  }

  private async buildPaymentItemsSheet(workbook: ExcelJS.Workbook, companyId: string) {
    const sheet = workbook.addWorksheet('Items de Pago');
    sheet.columns = [
      { header: 'ID', key: 'id', width: 28 },
      { header: 'Pago ID', key: 'paymentId', width: 28 },
      { header: 'Descripción', key: 'description', width: 30 },
      { header: 'Cantidad', key: 'quantity', width: 10 },
      { header: 'Precio Unit.', key: 'unitPrice', width: 12 },
      { header: 'Total', key: 'totalPrice', width: 12 },
      { header: 'Tipo', key: 'itemType', width: 16 },
    ];
    const rows = await this.getAllPaginated(
      (page, take) =>
        this.prisma.paymentItem.findMany({
          where: { payment: { companyId, isDeleted: false } },
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * take,
          take,
        }),
    );
    rows.forEach((r) =>
      sheet.addRow({
        id: r.id,
        paymentId: r.paymentId,
        description: r.description,
        quantity: r.quantity,
        unitPrice: r.unitPrice,
        totalPrice: r.totalPrice,
        itemType: r.itemType,
      }),
    );
    this.styleHeaderRow(sheet);
  }

  private async buildDebtsSheet(workbook: ExcelJS.Workbook, companyId: string) {
    const sheet = workbook.addWorksheet('Deudas');
    sheet.columns = [
      { header: 'ID', key: 'id', width: 28 },
      { header: 'Cliente', key: 'clientName', width: 26 },
      { header: 'Monto', key: 'amount', width: 12 },
      { header: 'Estado', key: 'status', width: 12 },
      { header: 'Vencimiento', key: 'dueDate', width: 14 },
      { header: 'Interés (% mes)', key: 'interestRate', width: 14 },
      { header: 'Notas', key: 'notes', width: 30 },
      { header: 'Creado', key: 'createdAt', width: 20 },
    ];
    const rows = await this.getAllPaginated(
      (page, take) =>
        this.prisma.debt.findMany({
          where: { companyId },
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * take,
          take,
          include: { client: { select: { name: true, lastName: true } } },
        }),
    );
    rows.forEach((r) =>
      sheet.addRow({
        id: r.id,
        clientName: `${r.client.name} ${r.client.lastName || ''}`.trim(),
        amount: r.amount,
        status: r.status,
        dueDate: r.dueDate?.toLocaleDateString() || '',
        interestRate: r.interestRate ?? '',
        notes: r.notes || '',
        createdAt: r.createdAt?.toLocaleDateString() || '',
      }),
    );
    this.styleHeaderRow(sheet);
  }

  private async buildSuppliesSheet(workbook: ExcelJS.Workbook, companyId: string) {
    const sheet = workbook.addWorksheet('Insumos');
    sheet.columns = [
      { header: 'ID', key: 'id', width: 28 },
      { header: 'Nombre', key: 'name', width: 26 },
      { header: 'Marca', key: 'brand', width: 18 },
      { header: 'Categoría', key: 'category', width: 16 },
      { header: 'Stock Actual', key: 'quantity', width: 12 },
      { header: 'Stock Mínimo', key: 'minQuantity', width: 12 },
      { header: 'Precio Costo', key: 'unitPrice', width: 12 },
      { header: 'Precio Venta', key: 'salePrice', width: 12 },
      { header: 'Unidad Stock', key: 'stockUnit', width: 14 },
      { header: 'Unid. por Stock', key: 'unitsPerStock', width: 14 },
      { header: 'Unidad Disp.', key: 'dispensingUnit', width: 14 },
    ];
    const rows = await this.getAllPaginated(
      (page, take) =>
        this.prisma.supply.findMany({
          where: { companyId },
          orderBy: { name: 'asc' },
          skip: (page - 1) * take,
          take,
        }),
    );
    rows.forEach((r) =>
      sheet.addRow({
        id: r.id,
        name: r.name,
        brand: r.brand || '',
        category: r.category || '',
        quantity: r.quantity,
        minQuantity: r.minQuantity ?? '',
        unitPrice: r.unitPrice ?? '',
        salePrice: r.salePrice ?? '',
        stockUnit: r.stockUnit || '',
        unitsPerStock: r.unitsPerStock ?? '',
        dispensingUnit: r.dispensingUnit || '',
      }),
    );
    this.styleHeaderRow(sheet);
  }

  private async buildSupplyPurchasesSheet(workbook: ExcelJS.Workbook, companyId: string) {
    const sheet = workbook.addWorksheet('Compras');
    sheet.columns = [
      { header: 'ID', key: 'id', width: 28 },
      { header: 'Insumo', key: 'supplyName', width: 26 },
      { header: 'Cantidad', key: 'quantity', width: 10 },
      { header: 'Costo Unit.', key: 'unitCost', width: 12 },
      { header: 'Costo Total', key: 'totalCost', width: 12 },
      { header: 'Proveedor', key: 'supplier', width: 20 },
      { header: 'Factura', key: 'invoiceNum', width: 16 },
      { header: 'Fecha', key: 'purchasedAt', width: 16 },
    ];
    const rows = await this.getAllPaginated(
      (page, take) =>
        this.prisma.supplyPurchase.findMany({
          where: { companyId },
          orderBy: { purchasedAt: 'desc' },
          skip: (page - 1) * take,
          take,
          include: { supply: { select: { name: true } } },
        }),
    );
    rows.forEach((r) =>
      sheet.addRow({
        id: r.id,
        supplyName: r.supply.name,
        quantity: r.quantity,
        unitCost: r.unitCost,
        totalCost: r.totalCost,
        supplier: r.supplier || '',
        invoiceNum: r.invoiceNum || '',
        purchasedAt: r.purchasedAt?.toLocaleDateString() || '',
      }),
    );
    this.styleHeaderRow(sheet);
  }

  private async buildCashMovementsSheet(workbook: ExcelJS.Workbook, companyId: string) {
    const sheet = workbook.addWorksheet('Movimientos de Caja');
    sheet.columns = [
      { header: 'ID', key: 'id', width: 28 },
      { header: 'Tipo', key: 'type', width: 12 },
      { header: 'Monto', key: 'amount', width: 12 },
      { header: 'Motivo', key: 'reason', width: 30 },
      { header: 'Fecha', key: 'createdAt', width: 20 },
      { header: 'Pago ID', key: 'paymentId', width: 28 },
    ];
    const rows = await this.getAllPaginated(
      (page, take) =>
        this.prisma.cashMovement.findMany({
          where: { companyId },
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * take,
          take,
        }),
    );
    rows.forEach((r) =>
      sheet.addRow({
        id: r.id,
        type: r.type,
        amount: r.amount,
        reason: r.reason || '',
        createdAt: r.createdAt?.toLocaleDateString() || '',
        paymentId: r.paymentId || '',
      }),
    );
    this.styleHeaderRow(sheet);
  }

  private async buildPriceItemsSheet(workbook: ExcelJS.Workbook, companyId: string) {
    const sheet = workbook.addWorksheet('Lista de Precios');
    sheet.columns = [
      { header: 'ID', key: 'id', width: 28 },
      { header: 'Nombre', key: 'name', width: 26 },
      { header: 'Categoría', key: 'category', width: 16 },
      { header: 'Precio', key: 'price', width: 12 },
      { header: 'Descripción', key: 'description', width: 30 },
      { header: 'Activo', key: 'isActive', width: 8 },
    ];
    const rows = await this.getAllPaginated(
      (page, take) =>
        this.prisma.priceItem.findMany({
          where: { companyId },
          orderBy: { name: 'asc' },
          skip: (page - 1) * take,
          take,
        }),
    );
    rows.forEach((r) =>
      sheet.addRow({
        id: r.id,
        name: r.name,
        category: r.category,
        price: r.price,
        description: r.description || '',
        isActive: r.isActive ? 'Sí' : 'No',
      }),
    );
    this.styleHeaderRow(sheet);
  }

  private async getAllPaginated<T>(
    fetchPage: (page: number, take: number) => Promise<T[]>,
  ): Promise<T[]> {
    const results: T[] = [];
    for (let page = 1; page <= MAX_PAGE; page++) {
      const rows = await fetchPage(page, DEFAULT_PAGE_SIZE);
      results.push(...rows);
      if (rows.length < DEFAULT_PAGE_SIZE) break;
    }
    return results;
  }
}
