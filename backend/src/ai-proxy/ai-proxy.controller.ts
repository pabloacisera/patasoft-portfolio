import { Controller, Post, Body, Get, UseGuards, UseInterceptors, UploadedFile, Param, Inject, forwardRef } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { AiProxyService } from './ai-proxy.service';
import { DocumentProcessorService } from '../queues/document-processor.service';
import { RagIngestionService } from './rag-ingestion.service';
import { ChatDto, TranscribeDto } from './dto/ai-proxy.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { BadRequestException } from '@nestjs/common';

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

  @Get('rag/status')
  @ApiOperation({ summary: 'Obtener estado del RAG de la empresa' })
  getRagStatus(@CurrentUser() user: RequestUser) {
    return this.aiProxyService.getRagStatus(user.companyId);
  }
}