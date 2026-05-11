import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DebtsService } from '../debts/debts.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';

@Injectable()
export class CronService {
  private readonly logger = new Logger(CronService.name);

  constructor(
    private debtsService: DebtsService,
    private subService: SubscriptionsService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_8AM)
  async handleDebtAlerts() {
    this.logger.log('Ejecutando proceso de alertas de deudas...');
    const result = await this.debtsService.processAlerts();
    this.logger.log(`Proceso de alertas de deudas completado: ${result.processed} deudas notificadas`);
  }

  @Cron(CronExpression.EVERY_DAY_AT_10AM)
  async handleSubscriptionExpirations() {
    this.logger.log('Ejecutando proceso de expiración de suscripciones...');
    await this.subService.checkExpirations();
    this.logger.log('Proceso de expiración de suscripciones completado');
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async handleSubscriptionExpirationsTest() {
    await this.subService.checkExpirations();
  }
}
