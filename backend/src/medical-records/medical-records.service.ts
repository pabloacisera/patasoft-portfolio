import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMedicalRecordDto, UpdateMedicalRecordDto } from './dto/medical-record.dto';

@Injectable()
export class MedicalRecordsService {
  private readonly logger = new Logger(MedicalRecordsService.name);

  constructor(private prisma: PrismaService) {}

  async findAll(companyId: string, pagination: { page?: number; limit?: number; petId?: string } = {}) {
    const page = Number(pagination.page) || 1;
    const limit = Number(pagination.limit) || 20;
    const petId = pagination.petId;
    const skip = (page - 1) * limit;

    const pets = await this.prisma.pet.findMany({ where: { companyId }, select: { id: true } });
    const petIds = pets.map(p => p.id);

    const where = {
      petId: { in: petIds },
      ...(petId && { petId }),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.medicalRecord.findMany({
        where,
        skip,
        take: limit,
        orderBy: { date: 'desc' },
        include: { pet: { select: { id: true, name: true, species: true } }, procedures: true, prescriptions: true },
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
    });
    if (!pet) throw new NotFoundException('Mascota no encontrada');

    const record = await this.prisma.medicalRecord.create({
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
            soldInClinic: !!p.soldInClinic,
            quantity: p.quantity || 1,
            dispensingQuantity: p.dispensingQuantity || null,
            dispensingUnit: p.dispensingUnit || null,
            doseQuantity: p.doseQuantity || null,
            doseUnit: p.doseUnit || null,
          }))
        } : undefined,
      },
      include: { pet: true, procedures: true, prescriptions: { include: { supply: true } } },
    });

    if (dto.prescriptions?.length) {
      for (const presc of dto.prescriptions) {
        if (presc.supplyId && presc.soldInClinic) {
          const supply = await this.prisma.supply.findFirst({ 
            where: { id: presc.supplyId, companyId } 
          });
          if (supply) {
            // Calcular cuánto descontar del stock
            let stockDiscount = presc.quantity || 1;
            
            if (presc.dispensingQuantity && supply.unitsPerStock && supply.unitsPerStock > 1) {
              // Tiene sistema de unidades configurado: calcular proporcionalmente
              stockDiscount = Math.ceil(presc.dispensingQuantity / supply.unitsPerStock);
            }
            
            const newQty = Math.max(0, supply.quantity - stockDiscount);
            await this.prisma.supply.update({ 
              where: { id: presc.supplyId }, 
              data: { quantity: newQty } 
            });
          }
        }
      }
    }

    if (dto.procedures?.length) {
      for (const proc of dto.procedures) {
        if (proc.supplyId) {
          const supply = await this.prisma.supply.findFirst({ where: { id: proc.supplyId, companyId } });
          if (supply) {
            const newQty = Math.max(0, supply.quantity - (proc.quantity || 1));
            await this.prisma.supply.update({ where: { id: proc.supplyId }, data: { quantity: newQty } });
            this.logger.log(`Stock descontado por procedure: ${supply.name} -${proc.quantity || 1} (quedan ${newQty})`);
          }
        }
      }
    }

    this.logger.log(`Historial creado: ${record.id} para mascota ${pet.name}`);
    return record;
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
      data: { isDeleted: true, deletedAt: new Date() } as any,
    });
    this.logger.log(`Historial eliminado (soft): ${id}`);
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
      },
    });
  }
}