import { Controller, Post, Body, Get, UseGuards, UseInterceptors, UploadedFile, Param, Inject, forwardRef, Res, Sse } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { AiProxyService } from './ai-proxy.service';
import { DocumentProcessorService } from '../queues/document-processor.service';
import { RagIngestionService } from './rag-ingestion.service';
import { ChatDto, TranscribeDto } from './dto/ai-proxy.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { BadRequestException } from '@nestjs/common';
import { Observable } from 'rxjs';

interface RequestUser {
  companyId: string;
  id: string;
  email: string;
  [key: string]: string | number | boolean | unknown;
}

@ApiTags('ai-proxy')
@Controller('api/v1/ai')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class AiProxyController {
  constructor(
    private readonly aiProxyService: AiProxyService,
    @Inject(forwardRef(() => DocumentProcessorService))
    private readonly documentProcessor: DocumentProcessorService,
    private readonly ragIngestionService: RagIngestionService,
  ) {}

  @Post('chat')
  @ApiOperation({ summary: 'Proxy de chat con asistente IA' })
  chat(@CurrentUser() user: RequestUser, @Body() dto: ChatDto) {
    return this.aiProxyService.chat(user.companyId, dto);
  }

  @Post('chat/stream')
  @ApiOperation({ summary: 'Proxy de chat con asistente IA (streaming)' })
  async chatStream(
    @CurrentUser() user: RequestUser,
    @Body() dto: ChatDto,
    @Res() res: Response,
  ) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    try {
      if (this.aiProxyService['scaleMode'] !== 'PRO') {
        const localRag = this.aiProxyService['localRagService'];
        if (!localRag) {
          res.write(`data: ${JSON.stringify({ error: 'Servicio de IA local no disponible' })}\n\n`);
          res.end();
          return;
        }

        const stream = localRag.queryStream(user.companyId, dto.message, dto.history || []);
        for await (const chunk of stream) {
          res.write(`data: ${JSON.stringify({ content: chunk })}\n\n`);
        }
        res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
        res.end();
        return;
      }

      const result = await this.aiProxyService.chat(user.companyId, dto);
      res.write(`data: ${JSON.stringify({ content: result.message?.content || result.response })}\n\n`);
      res.write(`data: ${JSON.stringify({ done: true, full: result.message?.content || result.response })}\n\n`);
      res.end();
    } catch (error) {
      res.status(500);
      res.write(`data: ${JSON.stringify({ error: error.message || 'Error en el servicio de IA' })}\n\n`);
      res.end();
    }
  }

  @Post('transcribe')
  @ApiOperation({ summary: 'Proxy de transcripción de audio (Whisper)' })
  transcribe(@Body() dto: TranscribeDto) {
    return this.aiProxyService.transcribe(dto.audioUrl);
  }

  @Get('models')
  @ApiOperation({ summary: 'Obtener modelos de IA disponibles' })
  getModels() {
    return this.aiProxyService.getModels();
  }

  @Post('rag/upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadRagDocument(
    @UploadedFile() file: Express.Multer.File,
    @Body('companyId') companyId: string,
  ) {
    if (!file) {
      throw new BadRequestException('No se proporcionó ningún archivo');
    }

    const isExcel = file.mimetype.includes('spreadsheet') || 
                   file.originalname.match(/\.(xlsx?|csv)$/);
    
    if (isExcel) {
      const jobId = await this.documentProcessor.enqueueDocument({
        companyId,
        fileName: file.originalname,
        fileBuffer: file.buffer,
        mimeType: file.mimetype,
      });
      return { 
        message: 'Documento encolado para procesamiento',
        jobId,
        status: 'processing'
      };
    }

    return this.aiProxyService.uploadRag(companyId, file);
  }

  @Post('rag/sync')
  @ApiOperation({ summary: 'Sincronizar datos de la empresa al RAG' })
  async syncRag(@CurrentUser() user: RequestUser) {
    return this.ragIngestionService.ingestCompanyData(user.companyId);
  }

  @Post('rag/sync/stream')
  @ApiOperation({ summary: 'Sincronizar RAG con progreso en tiempo real (SSE)' })
  async syncRagStream(@CurrentUser() user: RequestUser, @Res() res: Response) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    const send = (data: any) => {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    try {
      const companyId = user.companyId;

      send({ type: 'start', message: 'Iniciando sincronización RAG...', progress: 0 });

      await this.ragIngestionService.ingestCompanyData(companyId, (progress) => {
        send(progress);
      });

      send({ type: 'complete', message: 'Sincronización completada exitosamente!', progress: 100 });
      res.end();

    } catch (error) {
      send({ type: 'error', message: `Error: ${error.message}` });
      res.status(500);
      res.end();
    }
  }

  @Get('rag/status')
  @ApiOperation({ summary: 'Obtener estado del RAG de la empresa' })
  getRagStatus(@CurrentUser() user: RequestUser) {
    return this.aiProxyService.getRagStatus(user.companyId);
  }
}