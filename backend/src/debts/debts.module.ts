import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { DebtsController } from './debts.controller';
import { DebtsService } from './debts.service';
import { PrismaModule } from '../prisma/prisma.module';
import { CloudinaryModule } from '../cloudinary/cloudinary.module';
import { EventsModule } from '../events/events.module';
import { CashRegisterModule } from '../cash-register/cash-register.module';

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET,
      signOptions: { expiresIn: process.env.JWT_EXPIRES_IN || '7d' },
    }),
    PrismaModule,
    CloudinaryModule,
    EventsModule,
    CashRegisterModule,
  ],
  controllers: [DebtsController],
  providers: [DebtsService],
  exports: [DebtsService],
})
export class DebtsModule {}