import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCompanyDto, UpdateCompanyDto } from './dto/company.dto';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class CompaniesService {
  private readonly logger = new Logger(CompaniesService.name);

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {}

  async findAll(pagination: { page?: number; limit?: number } = {}) {
    const { page = 1, limit = 20 } = pagination;
    const skip = (page - 1) * limit;

    const [data, total] = await this.prisma.$transaction([
      this.prisma.company.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { config: true, subscription: true },
      }),
      this.prisma.company.count(),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: number) {
    const company = await this.prisma.company.findUnique({
      where: { id },
      include: { config: true, subscription: true, users: { select: { id: true, name: true, email: true, role: true } } },
    });

    if (!company) {
      throw new NotFoundException('Empresa no encontrada');
    }

    return company;
  }

  async findMyCompany(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { company: { include: { config: true, subscription: true } } },
    });

    if (!user?.companyId) {
      return null;
    }

    return user.company;
  }

  async create(userId: number, dto: CreateCompanyDto) {
    const existingUser = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (existingUser?.companyId) {
      throw new BadRequestException('Ya tienes una empresa asociada');
    }

    const existingCuit = dto.cuit ? await this.prisma.company.findUnique({
      where: { cuit: dto.cuit },
    }) : null;

    if (existingCuit) {
      throw new BadRequestException('El CUIT ya está registrado');
    }

    const existingSlug = await this.prisma.company.findUnique({
      where: { slug: this.generateSlug(dto.name) },
    });

    const slug = existingSlug ? `${this.generateSlug(dto.name)}-${Date.now()}` : this.generateSlug(dto.name);

    const cloudinaryFolder = `patasoft/${slug}`;

    const company = await this.prisma.company.create({
      data: {
        name: dto.name,
        slug,
        legalName: dto.legalName,
        cuit: dto.cuit,
        municipalLicense: dto.municipalLicense,
        address: dto.address,
        phone: dto.phone,
        email: dto.email,
        website: dto.website,
        logoUrl: dto.logoUrl,
        cloudinaryFolder,
        animalSpecialties: dto.animalSpecialties || ['general'],
        isGeneral: dto.isGeneral ?? true,
        users: { connect: { id: userId } },
        config: {
          create: {
            currency: 'ARS',
            defaultAIModel: 'llama-3.3-70b-versatile',
            lowStockDefaultPct: 10,
            debtAlertDays: [1, 2],
            notifyEmail: true,
            notifyInApp: true,
            onboardComplete: true,
          },
        },
        subscription: {
          create: {
            plan: 'TRIAL',
            status: 'TRIAL',
            trialEndsAt: new Date(Date.now() + 72 * 60 * 60 * 1000), // 72 horas de trial
          },
        },
      },
      include: { config: true, subscription: true },
    });

    this.logger.log(`Empresa creada: ${company.name} (${company.id})`);

    return company;
  }

  async update(id: number, userId: number, dto: UpdateCompanyDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (user?.companyId !== id) {
      throw new BadRequestException('No tienes permiso para modificar esta empresa');
    }

    const existingSlug = dto.name ? await this.prisma.company.findFirst({
      where: { name: dto.name, NOT: { id } },
    }) : null;

    if (existingSlug && dto.name) {
      throw new BadRequestException('El nombre ya está en uso');
    }

    const company = await this.prisma.company.update({
      where: { id },
      data: {
        ...(dto.name && { name: dto.name, slug: this.generateSlug(dto.name) }),
        ...(dto.legalName && { legalName: dto.legalName }),
        ...(dto.address && { address: dto.address }),
        ...(dto.phone && { phone: dto.phone }),
        ...(dto.email && { email: dto.email }),
        ...(dto.website && { website: dto.website }),
        ...(dto.logoUrl && { logoUrl: dto.logoUrl }),
        ...(dto.animalSpecialties && { animalSpecialties: dto.animalSpecialties }),
        ...(dto.isGeneral !== undefined && { isGeneral: dto.isGeneral }),
      },
      include: { config: true },
    });

    this.logger.log(`Empresa actualizada: ${company.name}`);

    return company;
  }

  async delete(id: number, userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (user?.companyId !== id) {
      throw new BadRequestException('No tienes permiso para eliminar esta empresa');
    }

    if (user.role !== 'ADMIN_COMPANY' && user.role !== 'SUPER_ADMIN') {
      throw new BadRequestException('No tienes permiso de administrador');
    }

    await this.prisma.company.delete({
      where: { id },
    });

    this.logger.log(`Empresa eliminada: ${id}`);
  }

  async findBySlug(slug: string) {
    return this.prisma.company.findUnique({
      where: { slug },
      select: { id: true, name: true, slug: true, logoUrl: true, animalSpecialties: true },
    });
  }

  async search(q: string, excludeCompanyId: number) {
    if (!q || q.length < 2) return [];
    return this.prisma.company.findMany({
      where: {
        id: { not: excludeCompanyId },
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { email: { contains: q, mode: 'insensitive' } },
        ],
      },
      select: { id: true, name: true, email: true },
      take: 10,
    });
  }

  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }
}