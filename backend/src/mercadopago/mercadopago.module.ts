import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';
import { MercadopagoController } from './mercadopago.controller';
import { MercadopagoService } from './mercadopago.service';
import { PdfModule } from '../documents/pdf.module';
import { CashRegisterModule } from '../cash-register/cash-register.module';
import { EventsModule } from '../events/events.module';

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET,
      signOptions: { expiresIn: process.env.JWT_EXPIRES_IN || '7d' },
    }),
    ConfigModule,
    PdfModule,
    CashRegisterModule,
    EventsModule,
  ],
  controllers: [MercadopagoController],
  providers: [MercadopagoService],
  exports: [MercadopagoService],
})
export class MercadopagoModule {}