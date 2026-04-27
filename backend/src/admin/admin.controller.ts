import { Controller, Get, Patch, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { AdminQueryDto, BlockCompanyDto } from './dto/admin.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('admin')
@Controller('api/v1/admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN')
@ApiBearerAuth()
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('companies')
  @ApiOperation({ summary: 'Listar todas las empresas registradas' })
  listCompanies(@Query() query: AdminQueryDto) {
    return this.adminService.listCompanies(query);
  }

  @Patch('companies/:id/block')
  @ApiOperation({ summary: 'Bloquear una empresa' })
  blockCompany(@Param('id') id: string, @Body() dto: BlockCompanyDto) {
    return this.adminService.blockCompany(id, dto);
  }

  @Patch('companies/:id/unblock')
  @ApiOperation({ summary: 'Desbloquear una empresa' })
  unblockCompany(@Param('id') id: string) {
    return this.adminService.unblockCompany(id);
  }

  @Get('subscriptions')
  @ApiOperation({ summary: 'Listar todas las suscripciones' })
  listSubscriptions(@Query() query: AdminQueryDto) {
    return this.adminService.listSubscriptions(query);
  }
}
