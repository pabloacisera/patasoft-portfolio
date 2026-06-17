import { Controller, Get, Post, Patch, Delete, Body, Query, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ParseHashIdPipe } from '../common/pipes/parse-hash-id.pipe';
import { CashRegisterService } from './cash-register.service';
import { CreateCashMovementDto, UpdateCashMovementDto, CashSummaryQueryDto } from './dto/cash-movement.dto';

@ApiTags('cash-register')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api/v1/cash-register')
export class CashRegisterController {
  constructor(private cashService: CashRegisterService) {}

  @Get()
  @ApiOperation({ summary: 'Listar movimientos de caja' })
  async findAll(@CurrentUser() user: any, @Query() query: CashSummaryQueryDto) {
    return this.cashService.findAll(user.companyId, query);
  }

  @Get('summary')
  @ApiOperation({ summary: 'Resumen de caja (ingresos, egresos, saldo)' })
  async getSummary(@CurrentUser() user: any, @Query() query: CashSummaryQueryDto) {
    return this.cashService.getSummary(user.companyId, query);
  }

  @Post()
  @ApiOperation({ summary: 'Crear movimiento manual (egreso)' })
  async create(@CurrentUser() user: any, @Body() dto: CreateCashMovementDto) {
    return this.cashService.create(user.companyId, dto, user.id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Editar movimiento de caja' })
  async update(@CurrentUser() user: any, @Param('id', ParseHashIdPipe) id: number, @Body() dto: UpdateCashMovementDto) {
    return this.cashService.update(user.companyId, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar movimiento de caja' })
  async remove(@CurrentUser() user: any, @Param('id', ParseHashIdPipe) id: number) {
    return this.cashService.remove(user.companyId, id);
  }
}
