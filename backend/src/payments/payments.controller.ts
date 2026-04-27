import { 
  Controller, Get, Post, Patch, Delete, Body, Param, 
  UseGuards, Query, Res 
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { PaymentsService } from './payments.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Response } from 'express';
import { Public } from '../auth/decorators/public.decorator';

@ApiTags('payments') 
@ApiBearerAuth() 
@Controller('api/v1/payments')
export class PaymentsController {
  constructor(private s: PaymentsService) {}

  @Get() 
  @UseGuards(JwtAuthGuard)
  findAll(@CurrentUser() u: any, @Query() q: any) { 
    return this.s.findAll(u.companyId, q); 
  }

  @Post(':id/checkout')
  @UseGuards(JwtAuthGuard)
  generateCheckoutLink(@Param('id') id: string, @CurrentUser() u: any) {
    return this.s.generateCheckoutLink(id, u.companyId);
  }

  @Get(':id/receipt')
  @UseGuards(JwtAuthGuard)
  async generateReceipt(@Param('id') id: string, @CurrentUser() u: any, @Res() res: Response) {
    const buffer = await this.s.generateReceipt(id, u.companyId);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename=recibo_${id.slice(-6)}.pdf`,
      'Content-Length': buffer.byteLength,
    });
    return res.end(buffer);
  }

  @Public()
  @Post('webhook')
  handleWebhook(@Query() query: any) {
    return this.s.handleWebhook(query);
  }

  @Post() 
  @UseGuards(JwtAuthGuard)
  create(@Body() d: any, @CurrentUser() u: any) { 
    return this.s.create(u.companyId, d); 
  }

  @Patch(':id') 
  @UseGuards(JwtAuthGuard)
  update(@Param('id') id: string, @Body() d: any, @CurrentUser() u: any) { 
    return this.s.update(id, u.companyId, d); 
  }

  @Delete(':id') 
  @UseGuards(JwtAuthGuard)
  remove(@Param('id') id: string, @CurrentUser() u: any) { 
    return this.s.remove(id, u.companyId); 
  }
}
