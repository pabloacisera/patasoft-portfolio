import { Controller, Get, Post, Body, Headers, UseGuards, HttpCode, HttpStatus, Query, Res } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SubscriptionsService } from './subscriptions.service';
import { CreateSubscriptionCheckoutDto } from './dto/subscriptions.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('subscriptions')
@Controller('api/v1/subscriptions')
export class SubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @Get('status')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Obtener estado de la suscripción actual' })
  getStatus(@CurrentUser() user: any) {
    return this.subscriptionsService.getStatus(user.companyId);
  }

  @Post('checkout')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Iniciar checkout de suscripción con MercadoPago' })
  createCheckout(@CurrentUser() user: any, @Body() dto: CreateSubscriptionCheckoutDto) {
    return this.subscriptionsService.createCheckout(user.companyId, dto);
  }

  @Get('success')
  @HttpCode(HttpStatus.OK)
  handleSuccess(@Query() query: any, @Res() res: any) {
    return res.redirect(`http://localhost:5173/settings/subscription?status=success`);
  }

  @Get('failure')
  handleFailure(@Query() query: any, @Res() res: any) {
    return res.redirect(`http://localhost:5173/settings/subscription?status=failure`);
  }

  @Get('pending')
  handlePending(@Query() query: any, @Res() res: any) {
    return res.redirect(`http://localhost:5173/settings/subscription?status=pending`);
  }

  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Webhook de MercadoPago para suscripciones' })
  handleWebhook(@Body() data: any, @Headers('x-signature') signature: string, @Headers('x-request-id') requestId: string) {
    return this.subscriptionsService.handleWebhook(data, signature, requestId);
  }

  @Post('cancel')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cancelar suscripción activa' })
  cancel(@CurrentUser() user: any) {
    return this.subscriptionsService.cancel(user.companyId);
  }
}
