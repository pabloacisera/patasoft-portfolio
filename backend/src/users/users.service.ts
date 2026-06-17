import { Injectable, NotFoundException, Logger, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateUserDto, UserQueryDto } from './dto/users.dto';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(private prisma: PrismaService) {}

  async findAll(companyId: number, query: UserQueryDto) {
    const page = parseInt(query.page || '1');
    const limit = parseInt(query.limit || '10');
    const skip = (page - 1) * limit;

    const where: any = { companyId };

    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { email: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [total, items] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          avatarUrl: true,
          isActive: true,
          createdAt: true,
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

  async findOne(id: number, companyId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        avatarUrl: true,
        isActive: true,
        companyId: true,
        createdAt: true,
      },
    });

    if (!user || (companyId && user.companyId !== companyId)) {
      throw new NotFoundException('Usuario no encontrado');
    }

    return user;
  }

  async update(id: number, companyId: number, dto: UpdateUserDto) {
    const user = await this.findOne(id, companyId);

    const updatedUser = await this.prisma.user.update({
      where: { id: user.id },
      data: dto,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        avatarUrl: true,
        isActive: true,
        createdAt: true,
      },
    });

    this.logger.log(`Usuario ${id} actualizado`);
    return updatedUser;
  }

  async deactivate(id: number, companyId: number) {
    const user = await this.findOne(id, companyId);
    
    // No permitir que un usuario se desactive a sí mismo si es el único ADMIN_COMPANY (opcional, lógica simple por ahora)
    
    await this.prisma.user.update({
      where: { id: user.id },
      data: { isActive: false },
    });

    this.logger.log(`Usuario ${id} desactivado`);
    return { message: 'Usuario desactivado exitosamente' };
  }
}
