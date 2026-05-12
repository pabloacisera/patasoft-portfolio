import { Injectable, NotFoundException, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PdfService } from '../documents/pdf.service';
import { CreateMedicalRecordDto, UpdateMedicalRecordDto } from './dto/medical-record.dto';

@Injectable()
export class MedicalRecordsService {
  private readonly logger = new Logger(MedicalRecordsService.name);

  constructor(
    private prisma: PrismaService,
    private pdfService: PdfService,
  ) {}

  async findAll(companyId: string, pagination: any = {}) {
    const page = Number(pagination.page) || 1;
    const limit = Number(pagination.limit) || 20;
    const { petId, search, startDate, endDate } = pagination;
    const skip = (page - 1) * limit;

    const pets = await this.prisma.pet.findMany({ where: { companyId, isDeleted: false }, select: { id: true } });
    const petIds = pets.map(p => p.id);

    const where: any = {
      petId: { in: petIds },
      isDeleted: false,
      ...(petId && { petId }),
      ...(startDate || endDate ? {
        date: {
          ...(startDate && { gte: new Date(startDate) }),
          ...(endDate && { lte: new Date(endDate + 'T23:59:59') }),
        }
      } : {}),
      ...(search && {
        OR: [
          { visitReason: { contains: search, mode: 'insensitive' } },
          { diagnosis: { contains: search, mode: 'insensitive' } },
          { treatment: { contains: search, mode: 'insensitive' } },
          { observations: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.medicalRecord.findMany({
        where,
        skip,
        take: limit,
        orderBy: { date: 'desc' },
        include: {
          pet: {
            select: {
              id: true, name: true, species: true,
              client: { select: { id: true, name: true, lastName: true } },
            }
          },
          procedures: true,
          prescriptions: true,
        },
      }),
      this.prisma.medicalRecord.count({ where }),
    ]);

    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(id: string, companyId: string) {
    const pets = await this.prisma.pet.findMany({ where: { companyId }, select: { id: true } });
    const petIds = pets.map(p => p.id);

    const record = await this.prisma.medicalRecord.findFirst({
      where: { id, petId: { in: petIds } },
      include: {
        pet: { include: { client: true, photos: true } },
        procedures: { include: { priceItem: true } },
        prescriptions: { include: { supply: true } },
        payment: true,
      },
    });

    if (!record) throw new NotFoundException('Historial no encontrado');
    return record;
  }

  async create(companyId: string, dto: CreateMedicalRecordDto) {
    const pet = await this.prisma.pet.findFirst({
      where: { id: dto.petId, companyId },
      include: { client: true },
    });
    if (!pet) throw new NotFoundException('Mascota no encontrada');

    // Calcular items del pago (si vienen del frontend, usar esos; sino calcular)
    let totalAmount = dto.totalAmount || 0;
    
    const paymentItems = [];
    
    if (dto.totalAmount !== undefined && dto.totalAmount > 0) {
      totalAmount = dto.totalAmount;
    } else {
      for (const proc of (dto.procedures || [])) {
        let unitPrice = proc.customPrice || 0;
        if (proc.priceItemId && !proc.customPrice) {
          const pi = await this.prisma.priceItem.findUnique({ where: { id: proc.priceItemId } });
          unitPrice = pi?.price || 0;
        }
        if (proc.supplyId) {
          const supply = await this.prisma.supply.findUnique({ where: { id: proc.supplyId } });
          if (supply?.salePrice && supply?.unitsPerStock) {
            unitPrice = supply.salePrice / supply.unitsPerStock;
          }
        }
        const qty = proc.quantity || 1;
        const total = unitPrice * qty;
        totalAmount += total;
        if (unitPrice > 0) {
          paymentItems.push({
            description: proc.name,
            quantity: qty,
            unitPrice,
            totalPrice: total,
            itemType: proc.supplyId ? 'SUPPLY' : 'PROCEDURE',
          });
        }
      }
      
      for (const pres of (dto.prescriptions || [])) {
        if (!pres.soldInClinic || !pres.supplyId) continue;
        const supply = await this.prisma.supply.findUnique({ where: { id: pres.supplyId } });
        if (!supply) continue;
        const unitIndividual = supply.unitsPerStock ? (supply.salePrice || 0) / supply.unitsPerStock : (supply.salePrice || 0);
        const qty = pres.dispensingQuantity || pres.quantity || 1;
        const total = unitIndividual * qty;
        totalAmount += total;
        paymentItems.push({
          description: `${supply.name} (${qty} ${supply.dispensingUnit || 'u.'})`,
          quantity: qty,
          unitPrice: unitIndividual,
          totalPrice: total,
          itemType: 'SUPPLY',
        });
      }
    }

    // Transacción atómica
    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Crear MedicalRecord
      const record = await tx.medicalRecord.create({
        data: {
          petId: dto.petId,
          visitReason: dto.visitReason,
          diagnosis: dto.diagnosis,
          treatment: dto.treatment,
          observations: dto.observations,
          weight: dto.weight,
          temperature: dto.temperature,
          nextVisitDate: dto.nextVisitDate ? new Date(dto.nextVisitDate) : undefined,
          veterinarianId: dto.veterinarianId,
          date: dto.date ? new Date(dto.date) : undefined,
          procedures: dto.procedures?.length ? {
            create: dto.procedures.map(p => ({
              name: p.name,
              description: p.description,
              priceItemId: p.priceItemId || null,
              supplyId: p.supplyId || null,
              customPrice: p.customPrice,
              quantity: p.quantity || 1,
            }))
          } : undefined,
          prescriptions: dto.prescriptions?.length ? {
            create: dto.prescriptions.map(p => ({
              supplyId: p.supplyId || null,
              medicineName: p.medicineName,
              dose: p.dose,
              frequency: p.frequency,
              duration: p.duration,
              soldInClinic: p.soldInClinic || false,
              quantity: p.quantity || 1,
              dispensingQuantity: p.dispensingQuantity,
              dispensingUnit: p.dispensingUnit,
              doseQuantity: p.doseQuantity,
              doseUnit: p.doseUnit,
            }))
          } : undefined,
        },
        include: {
          procedures: true,
          prescriptions: true,
        },
      });

      // 2. Descontar stock de supplies usados en procedures
      for (const proc of (dto.procedures || [])) {
        if (!proc.supplyId) continue;
        const supply = await tx.supply.findUnique({ where: { id: proc.supplyId } });
        if (!supply) continue;
        const stockUnitsUsed = supply.unitsPerStock
          ? Math.ceil((proc.quantity || 1) / supply.unitsPerStock)
          : (proc.quantity || 1);
        await tx.supply.update({
          where: { id: proc.supplyId },
          data: { quantity: { decrement: stockUnitsUsed } },
        });
      }

      // 3. Descontar stock de prescriptions vendidas en clínica
      for (const pres of (dto.prescriptions || [])) {
        if (!pres.soldInClinic || !pres.supplyId) continue;
        const supply = await tx.supply.findUnique({ where: { id: pres.supplyId } });
        if (!supply) continue;
        const qty = pres.dispensingQuantity || pres.quantity || 1;
        const stockUnitsUsed = supply.unitsPerStock ? Math.ceil(qty / supply.unitsPerStock) : qty;
        await tx.supply.update({
          where: { id: pres.supplyId },
          data: { quantity: { decrement: stockUnitsUsed } },
        });
      }

      // 4. Crear Payment
      const paymentData: any = {
        companyId,
        clientId: pet.clientId || null,
        petId: pet.id,
        medicalRecordId: record.id,
        totalAmount,
        status: dto.paymentStatus || 'PENDING',
        items: { create: paymentItems },
      };
      
      if (dto.paymentMethod) {
        paymentData.method = dto.paymentMethod;
      }
      if (dto.paymentDueDate) {
        paymentData.dueDate = new Date(dto.paymentDueDate);
      }
      if (dto.paymentNotes) {
        paymentData.notes = dto.paymentNotes;
      }
      
      const payment = await tx.payment.create({
        data: paymentData,
        include: { items: true },
      });

      return { record, payment };
    });

    // 5. Generar PDFs en background (no bloquear la respuesta)
    this.generateAndStorePdfs(result.record.id, result.payment.id, companyId).catch(e =>
      this.logger.error('Error generando PDFs post-consulta', e)
    );

    this.logger.log(`Historial creado: ${result.record.id} para mascota ${pet.name}`);
    return result;
  }

  private async generateAndStorePdfs(recordId: string, paymentId: string, companyId: string) {
    await Promise.allSettled([
      this.pdfService.generateAndStorePrescription(recordId, companyId),
      this.pdfService.generateAndStoreReceipt(paymentId, companyId),
    ]);
  }

  async update(id: string, companyId: string, dto: UpdateMedicalRecordDto) {
    await this.findOne(id, companyId);

    return this.prisma.medicalRecord.update({
      where: { id },
      data: {
        ...(dto.visitReason && { visitReason: dto.visitReason }),
        ...(dto.diagnosis !== undefined && { diagnosis: dto.diagnosis }),
        ...(dto.treatment !== undefined && { treatment: dto.treatment }),
        ...(dto.observations !== undefined && { observations: dto.observations }),
        ...(dto.weight && { weight: dto.weight }),
        ...(dto.temperature && { temperature: dto.temperature }),
        ...(dto.nextVisitDate && { nextVisitDate: new Date(dto.nextVisitDate) }),
        ...(dto.veterinarianId && { veterinarianId: dto.veterinarianId }),
      },
      include: { pet: true, procedures: true, prescriptions: true },
    });
  }

  async remove(id: string, companyId: string) {
    await this.findOne(id, companyId);
    await this.prisma.medicalRecord.update({
      where: { id },
      data: { isDeleted: true, deletedAt: new Date() },
    });
    this.logger.log(`Historial eliminado (soft delete): ${id}`);
  }

  async addProcedure(recordId: string, companyId: string, dto: any) {
    await this.findOne(recordId, companyId);
    
    const procedure = await this.prisma.procedure.create({
      data: {
        medicalRecordId: recordId,
        name: dto.name,
        description: dto.description,
        priceItemId: dto.priceItemId,
        supplyId: dto.supplyId || null,
        customPrice: dto.customPrice,
        quantity: dto.quantity || 1,
      },
    });

    if (dto.supplyId) {
      const supply = await this.prisma.supply.findFirst({ where: { id: dto.supplyId, companyId } });
      if (supply) {
        const newQty = Math.max(0, supply.quantity - (dto.quantity || 1));
        await this.prisma.supply.update({ where: { id: dto.supplyId }, data: { quantity: newQty } });
        this.logger.log(`Stock descontado por procedure agregado: ${supply.name} -${dto.quantity || 1} (quedan ${newQty})`);
      }
    }

    return procedure;
  }

  async addPrescription(recordId: string, companyId: string, dto: any) {
    await this.findOne(recordId, companyId);
    return this.prisma.prescription.create({
      data: {
        medicalRecordId: recordId,
        supplyId: dto.supplyId,
        medicineName: dto.medicineName,
        dose: dto.dose,
        frequency: dto.frequency,
        duration: dto.duration,
        soldInClinic: dto.soldInClinic ?? false,
        quantity: dto.quantity || 1,
        dispensingQuantity: dto.dispensingQuantity,
        dispensingUnit: dto.dispensingUnit,
        doseQuantity: dto.doseQuantity,
        doseUnit: dto.doseUnit,
      },
    });
  }

  async findPrescriptionDocument(recordId: string, companyId: string) {
    return this.prisma.document.findFirst({
      where: {
        companyId,
        relatedEntityId: recordId,
        relatedEntity: 'MedicalRecord',
        type: 'EXPORT_PDF',
        name: { contains: 'Receta' },
        isDeleted: false,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async generateAndStorePrescription(recordId: string, companyId: string) {
    return this.pdfService.generateAndStorePrescription(recordId, companyId);
  }
}