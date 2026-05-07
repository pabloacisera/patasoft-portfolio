import { Injectable, Logger, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { ChatDto, TranscribeDto } from './dto/ai-proxy.dto';
import { LocalRagService } from './local-rag.service';

@Injectable()
export class AiProxyService {
  private readonly logger = new Logger(AiProxyService.name);
  private readonly scaleMode: string;
  private readonly aiBaseUrl: string;
  private localRagService: LocalRagService | null;

  constructor(
    private config: ConfigService,
    private prisma: PrismaService,
    localRagService: LocalRagService,
  ) {
    this.scaleMode = this.config.get<string>('SCALE_MODE') || 'PRO';
    
    if (this.scaleMode === 'PRO') {
      this.aiBaseUrl = this.config.get<string>('AI_SERVICE_URL') || 'http://localhost:8000';
      this.localRagService = null;
    } else {
      this.aiBaseUrl = '';
      this.localRagService = localRagService;
    }
  }

  async chat(companyId: string, dto: ChatDto) {
    const config = await this.prisma.companyConfig.findUnique({
      where: { companyId },
      include: { company: true },
    });

    if (!config) throw new NotFoundException('Configuración de empresa no encontrada');

    const messages = [];
    if (dto.history && Array.isArray(dto.history)) {
      for (const h of dto.history) {
        if (h.role && h.content) {
          messages.push({ role: h.role, content: h.content });
        }
      }
    }
    messages.push({ role: 'user', content: dto.message });

    const payload = {
      messages,
      model: dto.model || config.defaultAIModel || 'llama-3.3-70b-versatile',
      company_id: companyId,
      company_name: config.company.name,
      company_address: config.company.address || '',
      specialties: config.company.animalSpecialties || [],
      session_id: dto.sessionId || companyId,
    };

    try {
      const response = await fetch(`${this.aiBaseUrl}/api/v1/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const err = await response.text();
        this.logger.error(`AI Service Chat Error: ${err}`);
        throw new InternalServerErrorException('Error en el servicio de IA');
      }

      return await response.json();
    } catch (error) {
      this.logger.error(`AI Proxy connection error: ${error.message}`);
      throw new InternalServerErrorException('No se pudo conectar con el servicio de IA');
    }
  }

  async transcribe(audioUrl: string) {
    try {
      const response = await fetch(`${this.aiBaseUrl}/api/v1/transcribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audio_url: audioUrl }),
      });

      if (!response.ok) {
        const err = await response.text();
        this.logger.error(`AI Service Transcribe Error: ${err}`);
        throw new InternalServerErrorException('Error en la transcripción');
      }

      return await response.json();
    } catch (error) {
      this.logger.error(`AI Proxy transcription error: ${error.message}`);
      throw new InternalServerErrorException('Error de conexión en transcripción');
    }
  }

  async getModels() {
    try {
      const response = await fetch(`${this.aiBaseUrl}/api/v1/models`);
      if (!response.ok) throw new Error('Failed to fetch models');
      return await response.json();
    } catch (error) {
      this.logger.error(`AI Proxy models error: ${error.message}`);
      return {
        models: [
          'gpt-4o',
          'gemini-1.5-pro',
          'llama-3.3-70b-versatile'
        ]
      };
    }
  }

  async uploadRag(companyId: string, file: Express.Multer.File) {
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      throw new InternalServerErrorException('El archivo supera el límite de 10MB');
    }

    const allowedTypes = ['application/pdf', 'text/plain', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel', 'image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.mimetype) && !file.originalname.match(/\.(xlsx?|csv)$/)) {
      throw new InternalServerErrorException('Tipo de archivo no permitido. Se aceptan PDF, TXT, Excel e imágenes');
    }

    let content: string;
    if (file.mimetype === 'text/plain') {
      content = file.buffer.toString('utf-8');
    } else {
      content = `[Documento: ${file.originalname} - Tipo: ${file.mimetype}]`;
    }

    try {
      const response = await fetch(`${this.aiBaseUrl}/api/v1/rag/documents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          documents: [{
            content,
            metadata: {
              source: 'upload',
              filename: file.originalname,
              type: file.mimetype,
              uploadedAt: new Date().toISOString(),
            }
          }]
        }),
      });

      if (!response.ok) {
        const err = await response.text();
        this.logger.error(`RAG Upload Error: ${err}`);
        throw new InternalServerErrorException('Error al procesar documento');
      }

      return await response.json();
    } catch (error) {
      this.logger.error(`RAG upload error: ${error.message}`);
      throw new InternalServerErrorException('Error al subir documento al RAG');
    }
  }

  async getRagStatus(companyId: string) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { id: true, name: true },
    });

    if (!company) {
      this.logger.warn(`RAG status: Empresa no encontrada ${companyId}`);
      return { synced: false, documentsCount: 0, message: 'Empresa no encontrada' };
    }

    try {
      const response = await fetch(`${this.aiBaseUrl}/api/v1/rag/status/${companyId}`);
      if (!response.ok) {
        this.logger.warn(`RAG service returned ${response.status} for company ${companyId}`);
        return { synced: false, documentsCount: 0, company: company.name };
      }
      const result = await response.json();
      return result;
    } catch (error) {
      this.logger.error(`RAG status error: ${error.message}`);
      return { synced: false, documentsCount: 0, error: error.message };
    }
  }

  async sendToRag(companyId: string, documents: Array<{ content: string; metadata: Record<string, any> }>) {
    try {
      await fetch(`${this.aiBaseUrl}/api/v1/rag/documents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, documents }),
      });
    } catch (error) {
      this.logger.error(`Error enviando documentos al RAG: ${error.message}`);
    }
  }
}
