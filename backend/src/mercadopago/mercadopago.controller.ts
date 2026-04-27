import { Controller, Post, Get, Body, Param, Query, UseGuards, Headers } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { MercadopagoService } from './mercadopago.service';
import { CreatePreferenceDto, QrPaymentDto } from './dto/mercadopago.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('mercadopago')
@Controller('api/v1/mercadopago')
export class MercadopagoController {
  constructor(private mpService: MercadopagoService) {}

  @Post('preference')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  createPreference(@Body() dto: CreatePreferenceDto, @CurrentUser() user: any) {
    return this.mpService.createPreference(user.companyId, dto);
  }

  @Post('qr')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  createQrPayment(@Body() dto: QrPaymentDto, @CurrentUser() user: any) {
    return this.mpService.createQrPayment(user.companyId, dto);
  }

  @Post('webhook')
  @ApiOperation({ summary: 'Webhook de MercadoPago (sin auth)' })
  webhook(@Body() body: { topic: string; id: string }) {
    return this.mpService.handleWebhook(body.topic, body.id);
  }

  @Get('status/:mpPaymentId')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  getPaymentStatus(@Param('mpPaymentId') mpPaymentId: string, @CurrentUser() user: any) {
    return this.mpService.getPaymentStatus(mpPaymentId, user.companyId);
  }
}