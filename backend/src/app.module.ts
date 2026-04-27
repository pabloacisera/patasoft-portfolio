import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { CloudinaryModule } from './cloudinary/cloudinary.module';
import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { SubscriptionsModule } from './subscriptions/subscriptions.module';
import { AdminModule } from './admin/admin.module';
import { GuestModule } from './guest/guest.module';
import { AiProxyModule } from './ai-proxy/ai-proxy.module';
import { CronModule } from './cron/cron.module';
import { CompaniesModule } from './companies/companies.module';
import { ClientsModule } from './clients/clients.module';
import { PetsModule } from './pets/pets.module';
import { MedicalRecordsModule } from './medical-records/medical-records.module';
import { PdfModule } from './documents/pdf.module';
import { PaymentsModule } from './payments/payments.module';
import { DebtsModule } from './debts/debts.module';
import { SuppliesModule } from './supplies/supplies.module';
import { PriceItemsModule } from './price-items/price-items.module';
import { MercadopagoModule } from './mercadopago/mercadopago.module';
import { NotificationsModule } from './notifications/notifications.module';
import { EventsModule } from './events/events.module';
import { MailModule } from './mail/mail.module';
import { ConnectionsModule } from './connections/connections.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    PrismaModule,
    RedisModule,
    CloudinaryModule,
    HealthModule,
    AuthModule,
    UsersModule,
    SubscriptionsModule,
    AdminModule,
    GuestModule,
    AiProxyModule,
    CronModule,
    CompaniesModule,
    ClientsModule,
    PetsModule,
    MedicalRecordsModule,
    PdfModule,
    PaymentsModule,
    DebtsModule,
    SuppliesModule,
    PriceItemsModule,
    MercadopagoModule,
    NotificationsModule,
    EventsModule,
    MailModule,
    ConnectionsModule,
  ],
})
export class AppModule {}