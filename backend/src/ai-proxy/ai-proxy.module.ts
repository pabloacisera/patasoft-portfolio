import { Module, forwardRef } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { BullModule } from '@nestjs/bull';
import { ConfigModule } from '@nestjs/config';
import { AiProxyService } from './ai-proxy.service';
import { AiProxyController } from './ai-proxy.controller';
import { RagIngestionService } from './rag-ingestion.service';
import { LocalRagService } from './local-rag.service';
import { QueuesModule } from '../queues/queues.module';

@Module({
  imports: [
    ConfigModule,
    forwardRef(() => QueuesModule),
    MulterModule.register({ dest: '/tmp' }),
    BullModule.registerQueue({
      name: 'document-processing',
    }),
  ],
  controllers: [AiProxyController],
  providers: [AiProxyService, RagIngestionService, LocalRagService],
  exports: [AiProxyService, RagIngestionService, LocalRagService],
})
export class AiProxyModule {}