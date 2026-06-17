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
  private readonly aiApiKey: string | undefined;
  private localRagService: LocalRagService | null;

  getScaleMode(): string {
    return this.scaleMode;
  }

  getLocalRagService(): LocalRagService | null {
    return this.localRagService;
  }

  constructor(
    private config: ConfigService,
    private prisma: PrismaService,
    localRagService: LocalRagService,
  ) {
    this.scaleMode = this.config.get<string>('SCALE_MODE') || 'local';
    this.aiApiKey = this.config.get<string>('AI_SERVICE_API_KEY');
    
    if (this.scaleMode === 'PRO') {
      this.aiBaseUrl = this.config.get<string>('AI_SERVICE_URL') || 'http://localhost:8000';
      this.localRagService = null;
    } else {
      this.aiBaseUrl = '';
      this.localRagService = localRagService;
    }
  }

  private getHeaders(extra: Record<string, string> = {}): Record<string, string> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json', ...extra };
    if (this.aiApiKey) headers['X-API-Key'] = this.aiApiKey;
    return headers;
  }

  private async buildChatPayload(companyId: number, dto: ChatDto) {
    const config = await this.prisma.companyConfig.findUnique({
      where: { companyId },
      include: { company: true },
    });

    if (!config) {
      throw new NotFoundException('Configuración de empresa no encontrada');
    }

    const messages: Array<{ role: string; content: string }> = [];
    if (dto.history && Array.isArray(dto.history)) {
      for (const h of dto.history) {
        if (h.role && h.content) {
          messages.push({ role: h.role, content: h.content });
        }
      }
    }
    messages.push({ role: 'user', content: dto.message });

    return {
      payload: {
        messages,
        model: dto.model || config.defaultAIModel || 'llama-3.3-70b-versatile',
        company_id: companyId,
        company_name: config.company.name,
        company_address: config.company.address || '',
        specialties: config.company.animalSpecialties || [],
        session_id: dto.sessionId || companyId,
      },
      config,
    };
  }

  async chat(companyId: number, dto: ChatDto) {
    if (this.scaleMode !== 'PRO') {
      if (!this.localRagService) throw new InternalServerErrorException('Servicio de IA local no disponible');
      try {
        return await this.localRagService.query(companyId, dto.message, dto.history || []);
      } catch (error) {
        this.logger.error(`Local chat error: ${error.message}`);
        throw new InternalServerErrorException('Error en el servicio de IA');
      }
    }

    const { payload } = await this.buildChatPayload(companyId, dto);

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

  async chatStream(companyId: number, dto: ChatDto) {
    if (this.scaleMode !== 'PRO') {
      throw new InternalServerErrorException('El streaming remoto solo aplica en modo PRO');
    }

    const { payload } = await this.buildChatPayload(companyId, dto);

    try {
      const response = await fetch(`${this.aiBaseUrl}/api/v1/chat/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const err = await response.text();
        this.logger.error(`AI Service Chat Stream Error: ${err}`);
        throw new InternalServerErrorException('Error en el servicio de IA');
      }

      return response;
    } catch (error) {
      this.logger.error(`AI Proxy stream error: ${error.message}`);
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
      throw new InternalServerErrorException('No se pudieron obtener los modelos de IA');
    }
  }

  async uploadRag(companyId: number, file: Express.Multer.File) {
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) throw new InternalServerErrorException('El archivo supera el límite de 10MB');

    const allowedTypes = ['application/pdf', 'text/plain'];
    if (!allowedTypes.includes(file.mimetype)) {
      throw new InternalServerErrorException('Tipo de archivo no permitido. Se aceptan PDF y TXT');
    }

    const content = file.buffer.toString('utf-8');
    const documents = [{
      content,
      metadata: { source: 'upload', filename: file.originalname, uploadedAt: new Date().toISOString() }
    }];

    if (this.scaleMode !== 'PRO') {
      if (!this.localRagService) throw new InternalServerErrorException('Servicio RAG local no disponible');
      return await this.localRagService.addDocuments(companyId, documents);
    }

    try {
      const response = await fetch(`${this.aiBaseUrl}/api/v1/rag/documents`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ companyId, documents }),
      });
      if (!response.ok) throw new InternalServerErrorException('Error al procesar documento');
      return await response.json();
    } catch (error) {
      this.logger.error(`RAG upload error: ${error.message}`);
      throw new InternalServerErrorException('Error al subir documento al RAG');
    }
  }

  async getRagStatus(companyId: number) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { id: true, name: true },
    });
    if (!company) return { synced: false, documentsCount: 0 };

    if (this.scaleMode !== 'PRO') {
      return { synced: true, documentsCount: 0, company: company.name, mode: 'local' };
    }

    try {
      const response = await fetch(`${this.aiBaseUrl}/api/v1/rag/status/${companyId}`);
      if (!response.ok) return { synced: false, documentsCount: 0, company: company.name };
      return await response.json();
    } catch (error) {
      this.logger.error(`RAG status error: ${error.message}`);
      return { synced: false, documentsCount: 0, error: error.message };
    }
  }

  async sendToRag(companyId: number, documents: Array<{ content: string; metadata: Record<string, any> }>, progressCallback?: (data: any) => void) {
    try {
      if (this.scaleMode !== 'PRO') {
        if (this.localRagService) {
          await this.localRagService.addDocuments(companyId, documents, (progress) => {
            progressCallback?.(progress);
          });
        }
        return;
      }
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
