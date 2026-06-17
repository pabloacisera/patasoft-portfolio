import { Injectable, NotFoundException, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LocalRagService } from '../ai-proxy/local-rag.service';
import { PdfService } from '../documents/pdf.service';
import { CashRegisterService } from '../cash-register/cash-register.service';
import { DocumentProcessorService } from '../queues/document-processor.service';
import { SuppliesService } from '../supplies/supplies.service';
import { PetsService } from '../pets/pets.service';
import { CreateMedicalRecordDto, UpdateMedicalRecordDto } from './dto/medical-record.dto';

@Injectable()
export class MedicalRecordsService {
  private readonly logger = new Logger(MedicalRecordsService.name);
  private readonly MAX_PHOTOS_PER_CONSULTATION = 3;

  constructor(
    private prisma: PrismaService,
    private pdfService: PdfService,
    private rag: LocalRagService,
    private cashService: CashRegisterService,
    private documentProcessor: DocumentProcessorService,
    private suppliesService: SuppliesService,
    private petsService: PetsService,
  ) {}

  async findAll(companyId: number, pagination: any = {}) {
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

  async findOne(id: number, companyId: number, options?: { includePaymentRelations?: boolean }) {
    const pets = await this.prisma.pet.findMany({ where: { companyId }, select: { id: true } });
    const petIds = pets.map(p => p.id);

    const record = await this.prisma.medicalRecord.findFirst({
      where: { id, petId: { in: petIds } },
      include: {
        pet: { include: { client: true, photos: true } },
        procedures: { include: { priceItem: true } },
        prescriptions: { include: { supply: true } },
        payment: options?.includePaymentRelations ? {
          include: { items: true, debt: true }
        } : true,
      },
    });

    if (!record) throw new NotFoundException('Historial no encontrado');
    return record;
  }

  async create(companyId: number, dto: CreateMedicalRecordDto) {
    const pet = await this.prisma.pet.findFirst({
      where: { id: dto.petId, companyId },
      include: { client: true },
    });
    if (!pet) throw new NotFoundException('Mascota no encontrada');

    // Validaciones: price-items y supplies deben estar configurados si se usan
    if (dto.procedures?.length) {
      const hasPriceItemRef = dto.procedures.some(p => p.priceItemId);
      const hasSupplyRef = dto.procedures.some(p => p.supplyId);
      
      if (hasPriceItemRef) {
        const priceItemsCount = await this.prisma.priceItem.count({ where: { companyId, isActive: true } });
        if (priceItemsCount === 0) {
          throw new BadRequestException('No hay lista de precios configurada. Debe crear items de precio antes de agregar procedimientos.');
        }
      }
      
      if (hasSupplyRef) {
        const suppliesCount = await this.prisma.supply.count({ where: { companyId, isActive: true } });
        if (suppliesCount === 0) {
          throw new BadRequestException('No hay insumos configurados. Debe crear insumos antes de asociarlos a procedimientos.');
        }
      }
    }

    if (dto.prescriptions?.some(p => p.soldInClinic && p.supplyId)) {
      const suppliesCount = await this.prisma.supply.count({ where: { companyId, isActive: true } });
      if (suppliesCount === 0) {
        throw new BadRequestException('No hay insumos configurados. Debe crear insumos antes de venderlos en clínica.');
      }
    }

    if (dto.supplyItems?.length) {
      const suppliesCount = await this.prisma.supply.count({ where: { companyId, isActive: true } });
      if (suppliesCount === 0) {
        throw new BadRequestException('No hay insumos configurados. Debe crear insumos antes de agregarlos sueltos.');
      }
    }

    // Validar fotos (máximo 3)
    if (dto.photos && dto.photos.length > this.MAX_PHOTOS_PER_CONSULTATION) {
      throw new BadRequestException(`Máximo ${this.MAX_PHOTOS_PER_CONSULTATION} fotos por consulta`);
    }

    // Calcular items del pago (si vienen del frontend, usar esos; sino calcular)
    let totalAmount = dto.totalAmount || 0;
    
    const paymentItems: any[] = [];
    
    if (dto.totalAmount !== undefined && dto.totalAmount > 0) {
      totalAmount = dto.totalAmount;
    } else {
      for (const proc of (dto.procedures || [])) {
        let unitPrice = proc.customPrice || 0;
        if (proc.priceItemId && !proc.customPrice) {
          const pi = await this.prisma.priceItem.findUnique({ where: { id: proc.priceItemId } });
          unitPrice = pi?.price || 0;
        }
        if (!unitPrice && proc.supplyId) {
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

    for (const item of (dto.supplyItems || [])) {
      totalAmount += item.totalPrice || (item.unitPrice * item.quantity);
      paymentItems.push({
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalPrice: item.totalPrice || (item.unitPrice * item.quantity),
        itemType: 'SUPPLY',
      });
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
          veterinarianName: dto.veterinarianName,
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
              medicineName: p.medicineName || (p.supplyId ? 'Insumo clínico' : 'Indicación médica'),
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

      // 2. Subir fotos de la consulta (máx 3)
      if (dto.photos && dto.photos.length > 0) {
        for (const photo of dto.photos.slice(0, this.MAX_PHOTOS_PER_CONSULTATION)) {
          if (photo.url) {
            await tx.petPhoto.create({
              data: {
                petId: dto.petId,
                cloudinaryUrl: photo.url,
                cloudinaryId: `consultation_${record.id}_${Date.now()}`,
                isPrimary: false,
              },
            });
          }
        }
      }

      // 3. Descontar stock de supplies usados en procedures
      for (const proc of (dto.procedures || [])) {
        if (!proc.supplyId) continue;
        await this.suppliesService.deductStock(companyId, proc.supplyId, proc.quantity || 1, tx);
      }

      // 4. Descontar stock de prescriptions vendidas en clínica
      for (const pres of (dto.prescriptions || [])) {
        if (!pres.soldInClinic || !pres.supplyId) continue;
        const dispensingQty = pres.dispensingQuantity || pres.quantity || 1;
        await this.suppliesService.deductStock(companyId, pres.supplyId, dispensingQty, tx);
      }

      // 5. Crear Payment
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

    // 6. Movimiento de caja para pagos en efectivo
    if (dto.paymentMethod === 'CASH' && dto.paymentStatus === 'PAID') {
      await this.cashService.createFromPayment(companyId, result.payment.id, result.payment.totalAmount);
    }

    // 7. Generar PDFs via cola (no bloquear la respuesta)
    this.documentProcessor.enqueuePdfJob({ companyId, pdfType: 'prescription', recordId: result.record.id }).catch(e =>
      this.logger.error('Error encolando PDF receta', e)
    );
    this.documentProcessor.enqueuePdfJob({ companyId, pdfType: 'receipt', paymentId: result.payment.id }).catch(e =>
      this.logger.error('Error encolando PDF comprobante', e)
    );

    this.rag.upsertEmbedding(companyId,
      `Historia médica de ${pet.name}. Fecha: ${result.record.date}. Motivo: ${result.record.visitReason}. Diagnóstico: ${result.record.diagnosis || 'N/A'}. Tratamiento: ${result.record.treatment || 'N/A'}. Observaciones: ${result.record.observations || 'Sin observaciones'}.`,
      { source: 'medicalrecord', recordId: result.record.id, petId: pet.id, date: result.record.date }
    );

    this.logger.log(`Historial creado: ${result.record.id} para mascota ${pet.name}`);
    return result;
  }

  async update(id: number, companyId: number, dto: UpdateMedicalRecordDto) {
    await this.findOne(id, companyId);

    const record = await this.prisma.medicalRecord.update({
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

    this.rag.upsertEmbedding(companyId,
      `Historia médica de ${record.pet.name}. Fecha: ${record.date}. Motivo: ${record.visitReason}. Diagnóstico: ${record.diagnosis || 'N/A'}. Tratamiento: ${record.treatment || 'N/A'}. Observaciones: ${record.observations || 'Sin observaciones'}.`,
      { source: 'medicalrecord', recordId: record.id, petId: record.petId, date: record.date }
    );

    return record;
  }

  async remove(id: number, companyId: number) {
    await this.findOne(id, companyId);
    this.rag.deleteEmbedding(companyId, { source: 'medicalrecord', recordId: id });
    await this.prisma.medicalRecord.update({
      where: { id },
      data: { isDeleted: true, deletedAt: new Date() },
    });
    this.logger.log(`Historial eliminado (soft delete): ${id}`);
  }

  async addProcedure(recordId: number, companyId: number, dto: any) {
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
      await this.suppliesService.deductStock(companyId, dto.supplyId, dto.quantity || 1);
    }

    return procedure;
  }

  async addPrescription(recordId: number, companyId: number, dto: any) {
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

  async findPrescriptionDocument(recordId: number, companyId: number) {
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

  async generateAndStorePrescription(recordId: number, companyId: number) {
    return this.pdfService.generateAndStorePrescription(recordId, companyId);
  }

  async generateAndStoreReceipt(paymentId: number, companyId: number) {
    return this.pdfService.generateAndStoreReceipt(paymentId, companyId);
  }

  async cancel(recordId: number, companyId: number) {
    const record = await this.findOne(recordId, companyId, { includePaymentRelations: true }) as any;
    
    if (record.isDeleted) {
      throw new BadRequestException('La consulta ya está cancelada');
    }

    if (record.payment?.status === 'PAID' && record.payment.method !== 'CASH') {
      throw new BadRequestException('No se puede cancelar una consulta con pago electrónico confirmado. Contacte al administrador.');
    }

    return this.prisma.$transaction(async (tx) => {
      // 1. Restaurar stock de procedures
      for (const proc of record.procedures) {
        if (proc.supplyId) {
          await this.suppliesService.restoreStock(companyId, proc.supplyId, proc.quantity || 1, tx);
        }
      }

      // 2. Restaurar stock de prescriptions vendidas en clínica
      for (const pres of record.prescriptions) {
        if (pres.soldInClinic && pres.supplyId) {
          const dispensingQty = pres.dispensingQuantity || pres.quantity || 1;
          await this.suppliesService.restoreStock(companyId, pres.supplyId, dispensingQty, tx);
        }
      }

      // 3. Restaurar stock de payment.items (supplyItems sueltos) - intentar buscar supply por descripción
      if (record.payment?.items) {
        for (const item of record.payment.items) {
          const supply = await tx.supply.findFirst({
            where: { companyId, name: item.description }
          });
          if (supply) {
            await this.suppliesService.restoreStock(companyId, supply.id, item.quantity, tx);
          }
        }
      }

      // 4. Revertir movimiento de caja si era CASH + PAID
      if (record.payment?.method === 'CASH' && record.payment?.status === 'PAID') {
        await this.cashService.reverseFromPayment(companyId, record.payment.id, tx);
      }

      // 5. Marcar payment como CANCELLED
      if (record.payment) {
        await tx.payment.update({
          where: { id: record.payment.id },
          data: { status: 'CANCELLED', deletedAt: new Date(), isDeleted: true },
        });
      }

      // 6. Soft delete debt si existe
      if (record.payment?.debt) {
        await tx.debt.update({
          where: { id: record.payment.debt.id },
          data: { status: 'CANCELLED', cancelledAt: new Date(), isDeleted: true },
        });
      }

      // 7. Marcar medicalRecord como eliminado
      const cancelledRecord = await tx.medicalRecord.update({
        where: { id: recordId },
        data: { isDeleted: true, deletedAt: new Date() },
      });

      this.rag.deleteEmbedding(companyId, { source: 'medicalrecord', recordId });
      this.logger.log(`Consulta cancelada: ${recordId} - stock y caja restaurados`);

      return { record: cancelledRecord, payment: record.payment };
    });
  }
}