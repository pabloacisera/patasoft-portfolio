import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DebtsService } from '../debts/debts.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';

const SELF_URL = process.env.RENDER_EXTERNAL_URL || 'http://localhost:3000';

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

  @Cron(CronExpression.EVERY_5_MINUTES)
  async keepAlive() {
    try {
      const res = await fetch(`${SELF_URL}/health`, { signal: AbortSignal.timeout(10000) });
      if (!res.ok) {
        this.logger.warn(`Keep-alive responded with ${res.status}`);
      }
    } catch (e) {
      this.logger.warn(`Keep-alive falló: ${e.message}`);
    }
  }
}
