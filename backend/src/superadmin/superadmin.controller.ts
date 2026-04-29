import { Controller, Get, Patch, Body, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { SuperAdminService } from './superadmin.service';

@ApiTags('superadmin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN)
@Controller('api/v1/superadmin')
export class SuperAdminController {
  constructor(private superAdminService: SuperAdminService) {}

  @Get('companies')
  @ApiOperation({ summary: 'Listar todas las empresas (solo SUPER_ADMIN)' })
  async getCompanies() {
    return this.superAdminService.findAllCompanies();
  }

  @Patch('companies/:id/subscription')
  @ApiOperation({ summary: 'Actualizar suscripción de empresa' })
  async updateSubscription(@Param('id') companyId: string, @Body() dto: any) {
    return this.superAdminService.updateCompanySubscription(companyId, dto);
  }

  @Get('config')
  @ApiOperation({ summary: 'Obtener configuración global' })
  async getConfig() {
    return this.superAdminService.getGlobalConfig();
  }

  @Patch('config')
  @ApiOperation({ summary: 'Actualizar configuración global' })
  async updateConfig(@Body() dto: any) {
    return this.superAdminService.updateGlobalConfig(dto);
  }

  @Get('companies/:id/payments')
  @ApiOperation({ summary: 'Historial de pagos de una empresa' })
  async getCompanyPayments(@Param('id') companyId: string) {
    return this.superAdminService.getCompanyPaymentHistory(companyId);
  }
}
