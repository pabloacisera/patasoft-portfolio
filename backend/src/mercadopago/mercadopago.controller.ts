import { Controller, Post, Get, Body, Param, Query, UseGuards, Headers, Res, Delete } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { MercadopagoService } from './mercadopago.service';
import { CreatePreferenceDto, QrPaymentDto } from './dto/mercadopago.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { ConfigService } from '@nestjs/config';

@ApiTags('mercadopago')
@Controller('api/v1/mercadopago')
export class MercadopagoController {
  constructor(
    private mpService: MercadopagoService,
    private config: ConfigService,
  ) {}

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
  @Public()
  @ApiOperation({ summary: 'Webhook de MercadoPago (sin auth)' })
  webhook(@Query('topic') topic: string, @Query('id') id: string, @Body() body: any) {
    const t = topic || body?.topic || body?.type;
    const paymentId = id || body?.id || body?.data?.id;
    return this.mpService.handleWebhook(t, paymentId);
  }

  @Get('status/:mpPaymentId')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  getPaymentStatus(@Param('mpPaymentId') mpPaymentId: string, @CurrentUser() user: any) {
    return this.mpService.getPaymentStatus(mpPaymentId, user.companyId);
  }

  @Get('oauth/connect')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  oauthConnect(@CurrentUser() user: any) {
    const appId = this.config.get('MP_APP_ID');
    const backendUrl = this.config.get('BACKEND_URL');
    const redirectUri = encodeURIComponent(`${backendUrl}/api/v1/mercadopago/oauth/callback`);
    const state = Buffer.from(JSON.stringify({ companyId: user.companyId, userId: user.id })).toString('base64');
    const url = `https://auth.mercadopago.com/authorization?client_id=${appId}&response_type=code&platform_id=mp&state=${state}&redirect_uri=${redirectUri}`;
    return { url };
  }

  @Get('oauth/callback')
  @Public()
  async oauthCallback(@Query('code') code: string, @Query('state') state: string, @Res() res: any) {
    try {
      const { companyId } = JSON.parse(Buffer.from(state, 'base64').toString());
      await this.mpService.handleOAuthCallback(companyId, code);
      return res.redirect(`${this.config.get('FRONTEND_URL')}/settings/mercadopago?connected=true`);
    } catch(e) {
      return res.redirect(`${this.config.get('FRONTEND_URL')}/settings/mercadopago?error=oauth_failed`);
    }
  }

  @Delete('oauth/disconnect')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  async oauthDisconnect(@CurrentUser() user: any) {
    return this.mpService.disconnectOAuth(user.companyId);
  }

  @Get('oauth/status')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  async oauthStatus(@CurrentUser() user: any) {
    return this.mpService.getOAuthStatus(user.companyId);
  }
}
