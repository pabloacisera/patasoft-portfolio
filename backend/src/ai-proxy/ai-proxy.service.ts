import { Injectable, Logger, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { ChatDto, TranscribeDto } from './dto/ai-proxy.dto';

@Injectable()
export class AiProxyService {
  private readonly logger = new Logger(AiProxyService.name);
  private readonly aiBaseUrl: string;

  constructor(
    private config: ConfigService,
    private prisma: PrismaService,
  ) {
    this.aiBaseUrl = this.config.get<string>('AI_SERVICE_URL') || 'http://ai-service:8000';
  }

  async chat(companyId: string, dto: ChatDto) {
    const config = await this.prisma.companyConfig.findUnique({
      where: { companyId },
      include: { company: true },
    });

    if (!config) throw new NotFoundException('Configuración de empresa no encontrada');

    const payload = {
      message: dto.message,
      model: dto.model || config.defaultAIModel,
      history: dto.history || [],
      company_id: companyId,
      company_name: config.company.name,
      specialties: config.company.animalSpecialties,
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
      // Fallback a modelos conocidos si falla la conexión
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
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      throw new InternalServerErrorException('El archivo supera el límite de 10MB');
    }

    const allowedTypes = ['application/pdf', 'text/plain'];
    if (!allowedTypes.includes(file.mimetype)) {
      throw new InternalServerErrorException('Tipo de archivo no permitido. Solo PDF y TXT');
    }

    // Leer contenido del archivo
    let content: string;
    if (file.mimetype === 'text/plain') {
      content = file.buffer.toString('utf-8');
    } else {
      // PDF - extracción básica (el ai-service puede procesarlo mejor)
      content = `[Documento PDF: ${file.originalname}]`;
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

  async syncRagData(companyId: string) {
    // Obtener todos los datos de la empresa para el RAG
    const results = {
      clients: 0,
      pets: 0,
      supplies: 0,
      medicalRecords: 0,
      company: null,
    };

    try {
      // 1. Datos de la empresa
      const company = await this.prisma.company.findUnique({ where: { id: companyId } });
      if (company) {
        results.company = {
          content: `Veterinaria: ${company.name}. Dirección: ${company.address || 'No especificada'}. Teléfono: ${company.phone || 'No especificado'}. Email: ${company.email || 'No especificado'}.`,
          metadata: { source: 'company', type: 'company' }
        };
      }

      // 2. Clientes
      const clients = await this.prisma.client.findMany({ where: { companyId } });
      results.clients = clients.length;
      if (clients.length > 0) {
        const clientDocs = clients.map(c => ({
          content: `Cliente: ${c.name}. DNI: ${c.dni || 'N/A'}. Email: ${c.email || 'N/A'}. Teléfono: ${c.phone || 'N/A'}. Dirección: ${c.address || 'N/A'}.`,
          metadata: { source: 'client', clientId: c.id, name: c.name }
        }));

        await this.sendToRag(companyId, clientDocs);
      }

      // 3. Mascotas
      const pets = await this.prisma.pet.findMany({ 
        where: { companyId },
        include: { client: true }
      });
      results.pets = pets.length;
      if (pets.length > 0) {
        const petDocs = pets.map(p => {
          const ownerName = p.client?.name || 'N/A';
          let ageText = 'N/A';
          if (p.birthDate) {
            const ageMs = Date.now() - p.birthDate.getTime();
            ageText = Math.floor(ageMs / (365.25 * 24 * 60 * 60 * 1000)) + ' años';
          }
          return {
            content: `Mascota: ${p.name}. Especie: ${p.species}. Raza: ${p.breed || 'N/A'}. Peso: ${p.weight || 'N/A'}kg. Edad: ${ageText}. Dueño: ${ownerName}. Notas: ${p.notes || 'Sin notas'}.`,
            metadata: { source: 'pet', petId: p.id, name: p.name }
          };
        });

        await this.sendToRag(companyId, petDocs);
      }

      // 4. Insumos/Stock
      const supplies = await this.prisma.supply.findMany({ where: { companyId } });
      results.supplies = supplies.length;
      if (supplies.length > 0) {
        const supplyDocs = supplies.map(s => ({
          content: `Insumo: ${s.name}. Marca: ${s.brand || 'N/A'}. Cantidad: ${s.quantity}. Unidad: ${s.unit || 'unidad'}. Precio: $${s.unitPrice}. Stock mínimo: ${s.minQuantity || 10}.`,
          metadata: { source: 'supply', supplyId: s.id, name: s.name }
        }));

        await this.sendToRag(companyId, supplyDocs);
      }

      // 5. Historiales médicos
      const medicalRecords = await this.prisma.medicalRecord.findMany({
        where: { pet: { companyId } },
        include: { pet: true },
        take: 100, // Limitar a los últimos 100
      });
      results.medicalRecords = medicalRecords.length;
      if (medicalRecords.length > 0) {
        const recordDocs = medicalRecords.map(r => ({
          content: `Historia médica de ${r.pet?.name || 'mascota'}. Fecha: ${r.date}. Motivo: ${r.visitReason}. Diagnóstico: ${r.diagnosis || 'N/A'}. Tratamiento: ${r.treatment || 'N/A'}. Observaciones: ${r.observations || 'Sin observaciones'}.`,
          metadata: { source: 'medicalrecord', recordId: r.id, petId: r.petId, date: r.date }
        }));

        await this.sendToRag(companyId, recordDocs);
      }

      // 6. Datos de la empresa también
      if (results.company) {
        await this.sendToRag(companyId, [results.company]);
      }

      this.logger.log(`RAG sync completado para company ${companyId}: ${JSON.stringify(results)}`);
      return { success: true, synced: results };

    } catch (error) {
      this.logger.error(`Error en syncRagData: ${error.message}`);
      throw new InternalServerErrorException('Error al sincronizar datos con el RAG');
    }
  }

  async getRagStatus(companyId: string) {
    try {
      const response = await fetch(`${this.aiBaseUrl}/api/v1/rag/status/${companyId}`);
      if (!response.ok) {
        return { synced: false, error: 'No se pudo obtener estado del RAG' };
      }
      return await response.json();
    } catch (error) {
      return { synced: false, error: error.message };
    }
  }

private async sendToRag(companyId: string, documents: any[]) {
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
