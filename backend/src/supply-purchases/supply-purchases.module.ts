import { Module } from '@nestjs/common';
import { SupplyPurchasesController } from './supply-purchases.controller';
import { SupplyPurchasesService } from './supply-purchases.service';
import { PrismaModule } from '../prisma/prisma.module';
import { CashRegisterModule } from '../cash-register/cash-register.module';

@Module({
  imports: [PrismaModule, CashRegisterModule],
  controllers: [SupplyPurchasesController],
  providers: [SupplyPurchasesService],
})
export class SupplyPurchasesModule {}
