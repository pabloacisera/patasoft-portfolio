import { Module, forwardRef } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { DocumentProcessorService } from './document-processor.service';
import { AiProxyModule } from '../ai-proxy/ai-proxy.module';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    forwardRef(() => AiProxyModule),
    BullModule.registerQueue({
      name: 'document-processing',
    }),
  ],
  providers: [DocumentProcessorService],
  exports: [DocumentProcessorService],
})
export class QueuesModule {}