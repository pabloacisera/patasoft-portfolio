import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { SupplyPurchasesService } from './supply-purchases.service';

@ApiTags('supply-purchases')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api/v1/supply-purchases')
export class SupplyPurchasesController {
  constructor(private purchasesService: SupplyPurchasesService) {}

  @Get()
  async findAll(@CurrentUser() user: any, @Query() query: any) {
    return this.purchasesService.findAll(user.companyId, query);
  }

  @Post()
  async create(@CurrentUser() user: any, @Body() dto: any) {
    return this.purchasesService.create(user.companyId, dto);
  }

  @Get('export')
  async exportExcel(@CurrentUser() user: any) {
    const buffer = await this.purchasesService.exportExcel(user.companyId);
    return {
      buffer,
      filename: `compras_${new Date().toISOString().split('T')[0]}.xlsx`,
    };
  }
}
