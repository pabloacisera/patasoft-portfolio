import { Module } from '@nestjs/common';
import { SupplyPurchasesController } from './supply-purchases.controller';
import { SupplyPurchasesService } from './supply-purchases.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [SupplyPurchasesController],
  providers: [SupplyPurchasesService],
})
export class SupplyPurchasesModule {}
