import { Module } from '@nestjs/common';
import { CompaniesModule } from '../../companies/companies.module';
import { ClientsModule } from '../../clients/clients.module';
import { PetsModule } from '../../pets/pets.module';
import { MedicalRecordsModule } from '../../medical-records/medical-records.module';
import { PdfModule } from '../../documents/pdf.module';
import { PaymentsModule } from '../../payments/payments.module';
import { DebtsModule } from '../../debts/debts.module';
import { SuppliesModule } from '../../supplies/supplies.module';
import { PriceItemsModule } from '../../price-items/price-items.module';
import { CashRegisterModule } from '../../cash-register/cash-register.module';
import { SupplyPurchasesModule } from '../../supply-purchases/supply-purchases.module';
import { NotificationsModule } from '../../notifications/notifications.module';

@Module({
  imports: [
    CompaniesModule,
    ClientsModule,
    PetsModule,
    MedicalRecordsModule,
    PdfModule,
    PaymentsModule,
    DebtsModule,
    SuppliesModule,
    PriceItemsModule,
    CashRegisterModule,
    SupplyPurchasesModule,
    NotificationsModule,
  ],
  exports: [
    CompaniesModule,
    ClientsModule,
    PetsModule,
    MedicalRecordsModule,
    PdfModule,
    PaymentsModule,
    DebtsModule,
    SuppliesModule,
    PriceItemsModule,
    CashRegisterModule,
    SupplyPurchasesModule,
    NotificationsModule,
  ],
})
export class VeterinaryModule {}
