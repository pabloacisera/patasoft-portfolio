import { Controller, Post, Body, Get, UseGuards, UseInterceptors, UploadedFile, Res, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { AiProxyService } from './ai-proxy.service';
import { ChatDto, TranscribeDto } from './dto/ai-proxy.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('ai-proxy')
@Controller('api/v1/ai')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class AiProxyController {
  constructor(private readonly aiProxyService: AiProxyService) {}

  @Post('chat')
  @ApiOperation({ summary: 'Proxy de chat con asistente IA' })
  chat(@CurrentUser() user: any, @Body() dto: ChatDto) {
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
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Subir documento a la base de conocimiento (RAG)' })
  @UseInterceptors(FileInterceptor('file'))
  uploadRag(@UploadedFile() file: Express.Multer.File, @CurrentUser() user: any) {
    return this.aiProxyService.uploadRag(user.companyId, file);
  }

  @Post('rag/sync')
  @ApiOperation({ summary: 'Sincronizar datos de la empresa al RAG' })
  syncRag(@CurrentUser() user: any) {
    return this.aiProxyService.syncRagData(user.companyId);
  }

  @Get('rag/status')
  @ApiOperation({ summary: 'Obtener estado del RAG de la empresa' })
  getRagStatus(@CurrentUser() user: any) {
    return this.aiProxyService.getRagStatus(user.companyId);
  }
}
