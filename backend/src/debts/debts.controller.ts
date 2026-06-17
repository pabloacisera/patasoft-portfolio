import { Controller, Get, Patch, Param, Query, UseGuards, Body } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { DebtsService } from './debts.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ParseHashIdPipe } from '../common/pipes/parse-hash-id.pipe';

@ApiTags('debts')
@ApiBearerAuth()
@Controller('api/v1/debts')
@UseGuards(JwtAuthGuard)
export class DebtsController {
  constructor(private debtsService: DebtsService) {}
  @Get() findAll(@CurrentUser() u: any, @Query() q: any) { return this.debtsService.findAll(u.companyId, q); }
  @Get(':id') findOne(@Param('id', ParseHashIdPipe) id: number, @CurrentUser() u: any) { return this.debtsService.findOne(id, u.companyId); }
  @Patch(':id/cancel') cancel(@Param('id', ParseHashIdPipe) id: number, @CurrentUser() u: any) { return this.debtsService.cancel(id, u.companyId); }
  @Patch(':id/pay') markPaid(@Param('id', ParseHashIdPipe) id: number, @CurrentUser() u: any, @Body() body: any) { return this.debtsService.markPaid(id, u.companyId, body); }
  @Get(':id/preview-amount') getPreviewAmount(@Param('id', ParseHashIdPipe) id: number, @CurrentUser() u: any) { return this.debtsService.getPreviewAmount(id, u.companyId); }
  @Get('overdue') getOverdue(@CurrentUser() u: any) { return this.debtsService.getOverdue(u.companyId); }
}