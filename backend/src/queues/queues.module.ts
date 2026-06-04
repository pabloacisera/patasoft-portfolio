import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { PdfModule } from '../documents/pdf.module';
import { DocumentProcessorService } from './document-processor.service';
import { AiProxyModule } from '../ai-proxy/ai-proxy.module';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    PdfModule,
    forwardRef(() => AiProxyModule),
  ],
  providers: [DocumentProcessorService],
  exports: [DocumentProcessorService],
})
export class QueuesModule {}