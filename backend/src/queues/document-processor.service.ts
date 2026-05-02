import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue, Worker, Job } from 'bullmq';
import * as XLSX from 'xlsx';
import { AiProxyService } from '../ai-proxy/ai-proxy.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DocumentProcessorService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DocumentProcessorService.name);
  private worker: Worker;
  private connection: any;

  constructor(
    private config: ConfigService,
    private aiProxy: AiProxyService,
    private prisma: PrismaService,
  ) {
    this.connection = {
      host: this.config.get('REDIS_HOST', 'localhost'),
      port: this.config.get('REDIS_PORT', 6379),
      password: this.config.get('REDIS_PASSWORD', undefined),
    };
  }

  async onModuleInit() {
    this.worker = new Worker('document-processing', async (job: Job) => {
      const { companyId, fileName, fileBuffer, mimeType } = job.data;
      this.logger.log(`Processing job ${job.id}: ${fileName}`);
      await this.processDocument(companyId, fileName, Buffer.from(fileBuffer), mimeType);
    }, { connection: this.connection });

    this.worker.on('completed', (job) => {
      this.logger.log(`Job ${job.id} completed`);
    });

    this.worker.on('failed', (job, err) => {
      this.logger.error(`Job ${job?.id} failed: ${err.message}`);
    });

    this.logger.log('Document processor worker initialized');
  }

  async onModuleDestroy() {
    await this.worker?.close();
  }

  async enqueueDocument(data: {
    companyId: string;
    fileName: string;
    fileBuffer: Buffer;
    mimeType: string;
  }): Promise<string> {
    const queue = new Queue('document-processing', { connection: this.connection });
    const job = await queue.add('process-document', data, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
    });
    await queue.close();
    return job.id.toString();
  }

  private async processDocument(companyId: string, fileName: string, buffer: Buffer, mimeType: string) {
    try {
      if (mimeType.includes('spreadsheet') || fileName.match(/\.(xlsx?|csv)$/)) {
        await this.processExcel(companyId, buffer, fileName);
      } else {
        await this.aiProxy.uploadRag(companyId, {
          buffer,
          originalname: fileName,
          mimetype: mimeType,
        } as any);
      }
      this.logger.log(`Document ${fileName} processed successfully`);
    } catch (error) {
      this.logger.error(`Error processing ${fileName}: ${error.message}`);
      throw error;
    }
  }

  private async processExcel(companyId: string, buffer: Buffer, fileName: string) {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json<any>(worksheet);

    this.logger.log(`Processing Excel with ${data.length} rows`);

    const priceItems = data
      .filter(row => row.name && row.price)
      .map(row => ({
        name: String(row.name),
        price: parseFloat(String(row.price)),
        category: row.category ? String(row.category) : null,
        description: row.description ? String(row.description) : null,
        companyId,
      }));

    if (priceItems.length > 0) {
      await this.prisma.priceItem.createMany({
        data: priceItems,
        skipDuplicates: true,
      });
      this.logger.log(`Created ${priceItems.length} price items from Excel`);
    }
  }
}
