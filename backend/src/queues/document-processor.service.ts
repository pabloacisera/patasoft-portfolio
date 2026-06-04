import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue, Worker, Job } from 'bullmq';
import * as XLSX from 'xlsx';
import { AiProxyService } from '../ai-proxy/ai-proxy.service';
import { PrismaService } from '../prisma/prisma.service';
import { PdfService } from '../documents/pdf.service';

@Injectable()
export class DocumentProcessorService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DocumentProcessorService.name);
  private useRedis: boolean;
  private redisConnection: any;
  private worker: Worker;
  private memoryQueue: any; // p-queue instance

  constructor(
    private config: ConfigService,
    private aiProxy: AiProxyService,
    private prisma: PrismaService,
    private pdfService: PdfService,
  ) {
    const redisUrl = this.config.get('REDIS_URL');
    
    if (redisUrl) {
      this.useRedis = true;
      this.redisConnection = {
        host: this.config.get('REDIS_HOST', 'localhost'),
        port: this.config.get('REDIS_PORT', 6379),
        password: this.config.get('REDIS_PASSWORD', undefined),
      };
      this.logger.log('✅ Using BullMQ with Redis');
    } else {
      this.useRedis = false;
      this.logger.log('⚠️ Using p-queue (in-memory) - no Redis available');
    }
  }

  async onModuleInit() {
    if (this.useRedis) {
      await this.initBullMQ();
    } else {
      await this.initPQueue();
    }
  }

  private async initBullMQ() {
    this.worker = new Worker('document-processing', async (job: Job) => {
      const { jobType, companyId } = job.data;

      if (jobType === 'pdf') {
        const { pdfType, recordId, paymentId } = job.data;
        this.logger.log(`[BullMQ] Processing PDF job ${job.id}: ${pdfType}`);
        await this.processPdf(companyId, pdfType, recordId, paymentId);
      } else {
        const { fileName, fileBuffer, mimeType } = job.data;
        this.logger.log(`[BullMQ] Processing job ${job.id}: ${fileName}`);
        await this.processDocument(companyId, fileName, Buffer.from(fileBuffer), mimeType);
      }
    }, { connection: this.redisConnection });

    this.worker.on('completed', (job) => {
      this.logger.log(`[BullMQ] Job ${job.id} completed`);
    });

    this.worker.on('failed', (job, err) => {
      this.logger.error(`[BullMQ] Job ${job?.id} failed: ${err.message}`);
    });

    this.logger.log('✅ BullMQ worker initialized');
  }

  private async initPQueue() {
    const PQueue = require('p-queue').default;
    this.memoryQueue = new PQueue({ concurrency: 2 });

    this.logger.log('✅ P-Queue (in-memory) initialized');
  }

  async onModuleDestroy() {
    if (this.useRedis && this.worker) {
      await this.worker.close();
    }
  }

  async enqueueDocument(data: {
    companyId: string;
    fileName: string;
    fileBuffer: Buffer;
    mimeType: string;
  }): Promise<string> {
    if (this.useRedis) {
      return this.enqueueWithBullMQ(data);
    } else {
      return this.enqueueWithPQueue(data);
    }
  }

  async enqueuePdfJob(data: {
    companyId: string;
    pdfType: 'prescription' | 'receipt';
    recordId?: string;
    paymentId?: string;
  }): Promise<string> {
    const payload = { jobType: 'pdf', ...data };

    if (this.useRedis) {
      return this.enqueueWithBullMQ(payload);
    } else {
      return this.enqueueWithPQueue(payload);
    }
  }

  private async enqueueWithBullMQ(data: any): Promise<string> {
    const queue = new Queue('document-processing', { connection: this.redisConnection });
    const job = await queue.add('process-document', data, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
    });
    await queue.close();
    return job.id.toString();
  }

  private async enqueueWithPQueue(data: any): Promise<string> {
    const jobId = `pqueue_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const isPdf = data.jobType === 'pdf';

    this.memoryQueue.add(async () => {
      try {
        if (isPdf) {
          this.logger.log(`[P-Queue] Processing PDF: ${data.pdfType}`);
          await this.processPdf(data.companyId, data.pdfType, data.recordId, data.paymentId);
          this.logger.log(`[P-Queue] Completed PDF: ${data.pdfType}`);
        } else {
          this.logger.log(`[P-Queue] Processing ${data.fileName}`);
          await this.processDocument(data.companyId, data.fileName, data.fileBuffer, data.mimeType);
          this.logger.log(`[P-Queue] Completed ${data.fileName}`);
        }
      } catch (error) {
        this.logger.error(`[P-Queue] Failed ${data.fileName || data.pdfType}: ${error.message}`);
      }
    });

    return jobId;
  }

  private async processPdf(companyId: string, pdfType: 'prescription' | 'receipt', recordId?: string, paymentId?: string) {
    try {
      if (pdfType === 'prescription' && recordId) {
        await this.pdfService.generateAndStorePrescription(recordId, companyId);
        this.logger.log(`PDF prescription ${recordId} generated`);
      } else if (pdfType === 'receipt' && paymentId) {
        await this.pdfService.generateAndStoreReceipt(paymentId, companyId);
        this.logger.log(`PDF receipt ${paymentId} generated`);
      }
    } catch (error) {
      this.logger.error(`Error generating PDF (${pdfType}): ${error.message}`);
      throw error;
    }
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
