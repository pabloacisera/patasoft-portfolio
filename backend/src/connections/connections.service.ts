import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateConnectionDto, UpdateConnectionDto, QueryConnectionDto } from './dto/connection.dto';
import { ShareMedicalRecordsDto } from './dto/share-medical-records.dto';
import { ConnectionStatus } from '@prisma/client';

@Injectable()
export class ConnectionsService {
  private readonly logger = new Logger(ConnectionsService.name);
  constructor(private prisma: PrismaService) {}

  async findAll(companyId: string, q: QueryConnectionDto = {}) {
    const page = Number(q.page) || 1;
    const limit = Number(q.limit) || 20;
    const status = q.status;
    const skip = (page - 1) * limit;

    const where: any = {
      OR: [{ companyAId: companyId }, { companyBId: companyId }],
    };
    if (status) where.status = status;

    const [data, total] = await this.prisma.$transaction([
      this.prisma.companyConnection.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { companyA: true, companyB: true },
      }),
      this.prisma.companyConnection.count({ where }),
    ]);

    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(id: string, companyId: string) {
    const c = await this.prisma.companyConnection.findFirst({
      where: { id, OR: [{ companyAId: companyId }, { companyBId: companyId }] },
      include: { companyA: true, companyB: true },
    });
    if (!c) throw new NotFoundException('Conexión no encontrada');
    return c;
  }

  async create(companyId: string, dto: CreateConnectionDto) {
    if (companyId === dto.companyBId) {
      throw new BadRequestException('No puedes conectar contigo mismo');
    }

    const existing = await this.prisma.companyConnection.findFirst({
      where: {
        OR: [
          { companyAId: companyId, companyBId: dto.companyBId },
          { companyAId: dto.companyBId, companyBId: companyId },
        ],
      },
    });
    if (existing) throw new BadRequestException('Ya existe una conexión con esta empresa');

    const companyB = await this.prisma.company.findUnique({ where: { id: dto.companyBId } });
    if (!companyB) throw new NotFoundException('Empresa no encontrada');

    const connection = await this.prisma.companyConnection.create({
      data: { companyAId: companyId, companyBId: dto.companyBId, requestedBy: companyId },
      include: { companyA: true, companyB: true },
    });

    this.logger.log(`Conexión creada: ${companyId} -> ${dto.companyBId}`);
    return connection;
  }

  async update(id: string, companyId: string, dto: UpdateConnectionDto) {
    const existing = await this.findOne(id, companyId);
    if (existing.companyAId !== companyId && existing.companyBId !== companyId) {
      throw new BadRequestException('No autorizado');
    }

    const isReceiver = existing.companyBId === companyId;
    if (!isReceiver) {
      throw new BadRequestException('Solo el receptor puede aceptar/rechazar');
    }

    return this.prisma.companyConnection.update({
      where: { id },
      data: { status: dto.status as ConnectionStatus, respondedAt: new Date() },
      include: { companyA: true, companyB: true },
    });
  }

  async remove(id: string, companyId: string) {
    const existing = await this.findOne(id, companyId);
    await this.prisma.companyConnection.delete({ where: { id } });
  }

  async getConnectedCompanies(companyId: string) {
    const connections = await this.prisma.companyConnection.findMany({
      where: {
        OR: [{ companyAId: companyId }, { companyBId: companyId }],
        status: 'ACCEPTED',
      },
      include: { companyA: true, companyB: true },
    });

    return connections.map((c) => (c.companyAId === companyId ? c.companyB : c.companyA));
  }

  async shareMedicalRecords(companyId: string, dto: ShareMedicalRecordsDto) {
    const connection = await this.prisma.companyConnection.findFirst({
      where: {
        OR: [{ companyAId: companyId, companyBId: dto.targetCompanyId }, { companyAId: dto.targetCompanyId, companyBId: companyId }],
        status: 'ACCEPTED',
      },
    });
    if (!connection) throw new BadRequestException('No tienes conexión con esa empresa');

    const records = await this.prisma.medicalRecord.findMany({
      where: { id: { in: dto.medicalRecordIds }, pet: { companyId } },
      include: { pet: true, procedures: true, prescriptions: true },
    });
    if (records.length === 0) throw new NotFoundException('No se encontraron registros médicos');

    this.logger.log(`Compartiendo ${records.length} registros de ${companyId} a ${dto.targetCompanyId}`);
    return { sharedRecords: records.length, notes: dto.notes };
  }

  async getSharedMedicalRecords(companyId: string, fromCompanyId: string) {
    const connection = await this.prisma.companyConnection.findFirst({
      where: {
        OR: [{ companyAId: companyId, companyBId: fromCompanyId }, { companyAId: fromCompanyId, companyBId: companyId }],
        status: 'ACCEPTED',
      },
    });
    if (!connection) throw new BadRequestException('No tienes conexión con esa empresa');

    return { message: 'Implementar RAG para compartir registros', fromCompanyId };
  }
}