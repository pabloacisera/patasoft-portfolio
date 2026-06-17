import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AdminQueryDto, BlockCompanyDto } from './dto/admin.dto';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(private prisma: PrismaService) {}

  async listCompanies(query: AdminQueryDto) {
    const page = parseInt(query.page || '1');
    const limit = parseInt(query.limit || '10');
    const skip = (page - 1) * limit;

    const where: any = {};
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { cuit: { contains: query.search, mode: 'insensitive' } },
        { email: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    if (query.status) {
      where.isBlocked = query.status === 'blocked';
    }

    const [total, items] = await Promise.all([
      this.prisma.company.count({ where }),
      this.prisma.company.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          subscription: true,
          _count: {
            select: {
              users: true,
              clients: true,
              pets: true,
            },
          },
        },
      }),
    ]);

    return {
      items,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async blockCompany(id: number, dto: BlockCompanyDto) {
    const company = await this.prisma.company.findUnique({ where: { id } });
    if (!company) throw new NotFoundException('Empresa no encontrada');

    const updated = await this.prisma.company.update({
      where: { id },
      data: {
        isBlocked: true,
        blockedReason: dto.reason,
      },
    });

    this.logger.warn(`Empresa ${id} bloqueada por SUPER_ADMIN. Razón: ${dto.reason}`);
    return updated;
  }

  async unblockCompany(id: number) {
    const company = await this.prisma.company.findUnique({ where: { id } });
    if (!company) throw new NotFoundException('Empresa no encontrada');

    const updated = await this.prisma.company.update({
      where: { id },
      data: {
        isBlocked: false,
        blockedReason: null,
      },
    });

    this.logger.log(`Empresa ${id} desbloqueada por SUPER_ADMIN`);
    return updated;
  }

  async listSubscriptions(query: AdminQueryDto) {
    const page = parseInt(query.page || '1');
    const limit = parseInt(query.limit || '10');
    const skip = (page - 1) * limit;

    const [total, items] = await Promise.all([
      this.prisma.subscription.count(),
      this.prisma.subscription.findMany({
        skip,
        take: limit,
        orderBy: { updatedAt: 'desc' },
        include: {
          company: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
        },
      }),
    ]);

    return {
      items,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
