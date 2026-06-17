import { Injectable, NotFoundException, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCompanyDto } from '../companies/dto/company.dto';

@Injectable()
export class SuperAdminService {
  private readonly logger = new Logger(SuperAdminService.name);

  constructor(private prisma: PrismaService) {}

  async findAllCompanies() {
    return this.prisma.company.findMany({
      include: {
        subscription: true,
        config: true,
        users: { where: { role: 'ADMIN_COMPANY' }, take: 1 },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateCompanySubscription(companyId: number, dto: any) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      include: { subscription: true },
    });

    if (!company) throw new NotFoundException('Empresa no encontrada');

    const updateData: any = {};
    if (dto.plan) updateData.plan = dto.plan;
    if (dto.status) updateData.status = dto.status;
    if (dto.expiresAt) {
      updateData.expiresAt = new Date(dto.expiresAt);
    }
    if (dto.indultMonths) {
      const months = parseInt(dto.indultMonths);
      const currentExpiry = company.subscription?.expiresAt || new Date();
      const newExpiry = new Date(currentExpiry);
      newExpiry.setMonth(newExpiry.getMonth() + months);
      updateData.expiresAt = newExpiry;
    }
    if (dto.blockedReason !== undefined) {
      updateData.blockedReason = dto.blockedReason;
      if (dto.blockedReason) {
        updateData.isBlocked = true;
      }
    }

    const subscription = await this.prisma.subscription.update({
      where: { companyId },
      data: updateData,
    });

    this.logger.log(`Suscripción actualizada para empresa ${companyId}`);
    return subscription;
  }

  async getGlobalConfig() {
    const configs = await this.prisma.globalConfig.findMany();
    const result: any = {};
    configs.forEach(c => {
      result[c.key] = c.value;
    });
    return result;
  }

  async updateGlobalConfig(dto: any) {
    const updates = [];
    for (const [key, value] of Object.entries(dto)) {
      updates.push(
        this.prisma.globalConfig.upsert({
          where: { key },
          update: { value: String(value) },
          create: { key, value: String(value) },
        })
      );
    }
    await Promise.all(updates);
    return this.getGlobalConfig();
  }

  async getCompanyPaymentHistory(companyId: number) {
    return this.prisma.payment.findMany({
      where: { companyId } as any,
      orderBy: { createdAt: 'desc' },
      include: { client: true, items: true },
    }).then((payments: any) => payments.filter((p: any) => !p.isDeleted));
  }
}
