import { 
  Controller, Get, Post, Patch, Delete, Body, Param, 
  UseGuards, Query, Res 
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { PaymentsService } from './payments.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ParseHashIdPipe } from '../common/pipes/parse-hash-id.pipe';
import { Response } from 'express';
import { Public } from '../auth/decorators/public.decorator';
import { PaymentResponseDto } from '../common/dto/response.dto';

@ApiTags('payments') 
@ApiBearerAuth() 
@Controller('api/v1/payments')
export class PaymentsController {
  constructor(private s: PaymentsService) {}

  @Get() 
  @UseGuards(JwtAuthGuard)
  @ApiResponse({ status: 200, type: [PaymentResponseDto] })
  findAll(@CurrentUser() u: any, @Query() q: any) { 
    return this.s.findAll(u.companyId, q); 
  }

  @Post(':id/checkout')
  @UseGuards(JwtAuthGuard)
  @ApiResponse({ status: 201, schema: { properties: { initPoint: { type: 'string' } } } })
  generateCheckoutLink(@Param('id', ParseHashIdPipe) id: number, @CurrentUser() u: any) {
    return this.s.generateCheckoutLink(id, u.companyId);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiResponse({ status: 200, type: PaymentResponseDto })
  findOne(@Param('id', ParseHashIdPipe) id: number, @CurrentUser() u: any) {
    return this.s.findOne(id, u.companyId);
  }

  @Get(':id/receipt')
  @UseGuards(JwtAuthGuard)
  @ApiResponse({ status: 200, description: 'Generates a PDF receipt' })
  async generateReceipt(@Param('id', ParseHashIdPipe) id: number, @CurrentUser() u: any, @Res() res: Response) {
    const buffer = await this.s.generateReceipt(id, u.companyId);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename=recibo_${String(id).padStart(6, '0')}.pdf`,
      'Content-Length': buffer.byteLength,
    });
    return res.end(buffer);
  }

  @Public()
  @Post('webhook')
  @ApiResponse({ status: 200 })
  handleWebhook(@Query() query: any) {
    return this.s.handleWebhook(query);
  }

  @Post() 
  @UseGuards(JwtAuthGuard)
  @ApiResponse({ status: 201, type: PaymentResponseDto })
  create(@Body() d: any, @CurrentUser() u: any) { 
    return this.s.create(u.companyId, d); 
  }

  @Patch(':id') 
  @UseGuards(JwtAuthGuard)
  @ApiResponse({ status: 200, type: PaymentResponseDto })
  update(@Param('id', ParseHashIdPipe) id: number, @Body() d: any, @CurrentUser() u: any) { 
    return this.s.update(id, u.companyId, d); 
  }

  @Delete(':id') 
  @UseGuards(JwtAuthGuard)
  @ApiResponse({ status: 200 })
  remove(@Param('id', ParseHashIdPipe) id: number, @CurrentUser() u: any) { 
    return this.s.remove(id, u.companyId); 
  }
}
