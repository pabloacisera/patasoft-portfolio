import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateNotificationDto, UpdateNotificationDto, QueryNotificationDto } from './dto/notification.dto';
import { NotificationType } from '@prisma/client';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  constructor(private prisma: PrismaService) {}

  async findAll(companyId: number, userId: number, q: QueryNotificationDto = {}) {
    const { page = 1, limit = 20, unreadOnly } = q;
    const skip = (page - 1) * limit;

    const where: any = { companyId, userId };
    if (unreadOnly) where.isRead = false;

    const [data, total] = await this.prisma.$transaction([
      this.prisma.notification.findMany({
        where, skip, take: limit, orderBy: { createdAt: 'desc' },
      }),
      this.prisma.notification.count({ where }),
    ]);

    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(id: number, companyId: number) {
    const n = await this.prisma.notification.findFirst({ where: { id, companyId } });
    if (!n) throw new NotFoundException('Notificación no encontrada');
    return n;
  }

  async create(companyId: number, dto: CreateNotificationDto) {
    const data: any = {
      companyId,
      userId: dto.userId,
      title: dto.title,
      message: dto.message,
      type: dto.type as NotificationType,
      data: dto.data,
    };
    if (dto.expiresAt) data.expiresAt = new Date(dto.expiresAt);

    return this.prisma.notification.create({ data });
  }

  async markAsRead(id: number, companyId: number) {
    await this.findOne(id, companyId);
    return this.prisma.notification.update({
      where: { id },
      data: { isRead: true },
    });
  }

  async markAllAsRead(companyId: number, userId: number) {
    return this.prisma.notification.updateMany({
      where: { companyId, userId, isRead: false },
      data: { isRead: true },
    });
  }

  async remove(id: number, companyId: number) {
    await this.findOne(id, companyId);
    await this.prisma.notification.delete({ where: { id } });
  }

  async createSystemNotification(companyId: number, userId: number | null, title: string, message: string, data?: Record<string, any>) {
    return this.prisma.notification.create({
      data: { companyId, userId, title, message, type: 'SYSTEM', data },
    });
  }
}