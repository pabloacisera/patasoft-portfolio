import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { PrismaModule } from '../prisma/prisma.module';
import { MercadopagoModule } from '../mercadopago/mercadopago.module';
import { PdfModule } from '../documents/pdf.module';
import { CashRegisterModule } from '../cash-register/cash-register.module';

@Module({
  imports: [
    PrismaModule,
    MercadopagoModule,
    PdfModule,
    CashRegisterModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET,
      signOptions: { expiresIn: process.env.JWT_EXPIRES_IN || '7d' },
    }),
  ],
  controllers: [PaymentsController],
  providers: [PaymentsService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
