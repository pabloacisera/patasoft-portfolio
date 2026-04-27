import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit() {
    this.logger.log('Conectando a PostgreSQL...');
    await this.$connect();
    this.logger.log('✅ PostgreSQL conectado');
  }

  async onModuleDestroy() {
    this.logger.log('Desconectando de PostgreSQL...');
    await this.$disconnect();
    this.logger.log('✅ PostgreSQL desconectado');
  }
}