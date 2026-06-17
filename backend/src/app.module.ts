import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { QueuesModule } from './queues/queues.module';
import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { SubscriptionsModule } from './subscriptions/subscriptions.module';
import { AdminModule } from './admin/admin.module';
import { GuestModule } from './guest/guest.module';
import { CronModule } from './cron/cron.module';
import { SuperAdminModule } from './superadmin/superadmin.module';
import { DataModule } from './data/data.module';
import { VeterinaryModule } from './common/modules/veterinary.module';
import { IntegrationsModule } from './common/modules/integrations.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.production', '.env'],
    }),
    ThrottlerModule.forRoot([{
      ttl: parseInt(process.env.THROTTLE_TTL || '60000', 10),
      limit: parseInt(process.env.THROTTLE_LIMIT || '100', 10),
    }]),
    // Infrastructure
    PrismaModule,
    RedisModule,
    QueuesModule,
    HealthModule,
    // Auth & Users
    AuthModule,
    UsersModule,
    SubscriptionsModule,
    GuestModule,
    // Admin
    AdminModule,
    SuperAdminModule,
    // Domain
    VeterinaryModule,
    IntegrationsModule,
    CronModule,
    DataModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}