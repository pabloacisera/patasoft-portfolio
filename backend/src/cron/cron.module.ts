import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { CronService } from './cron.service';
import { DebtsModule } from '../debts/debts.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    DebtsModule,
    SubscriptionsModule,
  ],
  providers: [CronService],
})
export class CronModule {}
