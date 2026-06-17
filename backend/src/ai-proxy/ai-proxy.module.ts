import { Module, forwardRef } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { ConfigModule } from '@nestjs/config';
import { AiProxyService } from './ai-proxy.service';
import { AiProxyController } from './ai-proxy.controller';
import { RagIngestionService } from './rag-ingestion.service';
import { LocalRagService } from './local-rag.service';
import { QueuesModule } from '../queues/queues.module';

@Module({
  imports: [
    ConfigModule,
    // forwardRef necesario: dependencia circular AiProxyModule <-> QueuesModule
    forwardRef(() => QueuesModule),
    MulterModule.register({ dest: '/tmp' }),
  ],
  controllers: [AiProxyController],
  providers: [AiProxyService, RagIngestionService, LocalRagService],
  exports: [AiProxyService, RagIngestionService, LocalRagService],
})
export class AiProxyModule {}