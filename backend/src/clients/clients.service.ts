import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateClientDto, UpdateClientDto } from './dto/client.dto';

@Injectable()
export class ClientsService {
  private readonly logger = new Logger(ClientsService.name);

  constructor(private prisma: PrismaService) {}

  async findAll(companyId: string, pagination: { page?: number; limit?: number; search?: string } = {}) {
    const page = Number(pagination.page) || 1;
    const limit = Number(pagination.limit) || 20;
    const search = pagination.search;
    const skip = (page - 1) * limit;

    const where = {
      companyId,
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' as const } },
          { lastName: { contains: search, mode: 'insensitive' as const } },
          { email: { contains: search, mode: 'insensitive' as const } },
          { phone: { contains: search, mode: 'insensitive' as const } },
        ],
      }),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.client.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { pets: { select: { id: true, name: true, species: true } } },
      }),
      this.prisma.client.count({ where }),
    ]);

    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(id: string, companyId: string) {
    const client = await this.prisma.client.findFirst({
      where: { id, companyId },
      include: {
        pets: { include: { photos: true } },
        payments: { orderBy: { createdAt: 'desc' }, take: 10 },
        debts: { orderBy: { createdAt: 'desc' }, take: 10 },
      },
    });

    if (!client) throw new NotFoundException('Cliente no encontrado');
    return client;
  }

  async create(companyId: string, dto: CreateClientDto) {
    const client = await this.prisma.client.create({
      data: {
        companyId,
        name: dto.name,
        lastName: dto.lastName,
        dni: dto.dni,
        cuil: dto.cuil,
        email: dto.email,
        phone: dto.phone,
        address: dto.address,
        isCompany: dto.isCompany ?? false,
        companyName: dto.companyName,
        notes: dto.notes,
      },
      include: { pets: true },
    });

    this.logger.log(`Cliente creado: ${client.name} (${client.id})`);
    return client;
  }

  async update(id: string, companyId: string, dto: UpdateClientDto) {
    await this.findOne(id, companyId);

    return this.prisma.client.update({
      where: { id },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.lastName && { lastName: dto.lastName }),
        ...(dto.dni && { dni: dto.dni }),
        ...(dto.cuil && { cuil: dto.cuil }),
        ...(dto.email && { email: dto.email }),
        ...(dto.phone && { phone: dto.phone }),
        ...(dto.address && { address: dto.address }),
        ...(dto.isCompany !== undefined && { isCompany: dto.isCompany }),
        ...(dto.companyName && { companyName: dto.companyName }),
        ...(dto.notes && { notes: dto.notes }),
      },
    });
  }

  async remove(id: string, companyId: string) {
    await this.findOne(id, companyId);

    const petsCount = await this.prisma.pet.count({ where: { clientId: id } });
    if (petsCount > 0) {
      throw new BadRequestException('El cliente tiene mascotas asociadas. Eliminar primero las mascotas.');
    }

    await this.prisma.client.delete({ where: { id } });
    this.logger.log(`Cliente eliminado: ${id}`);
  }

  async getPets(id: string, companyId: string) {
    return this.prisma.pet.findMany({
      where: { clientId: id, companyId },
      include: { photos: true },
    });
  }

  async getPayments(id: string, companyId: string) {
    return this.prisma.payment.findMany({
      where: { clientId: id, companyId },
      orderBy: { createdAt: 'desc' },
      include: { items: true, pet: true },
    });
  }

  async getDebts(id: string, companyId: string) {
    return this.prisma.debt.findMany({
      where: { clientId: id, companyId },
      orderBy: { createdAt: 'desc' },
    });
  }
}