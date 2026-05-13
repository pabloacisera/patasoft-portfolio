import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AiProxyService } from './ai-proxy.service';

type ProgressCallback = (data: { type: string; current: number; total: number; message: string; category?: string }) => void;

@Injectable()
export class RagIngestionService {
  private readonly logger = new Logger(RagIngestionService.name);

  constructor(
    private prisma: PrismaService,
    private aiProxy: AiProxyService,
  ) {}

  async ingestCompanyData(companyId: string, progressCallback?: ProgressCallback) {
    const results = {
      clients: 0,
      pets: 0,
      supplies: 0,
      medicalRecords: 0,
      prices: 0,
      company: false,
    };

    const send = (type: string, current: number, total: number, message: string, category?: string) => {
      progressCallback?.({ type, current, total, message, category });
    };

    const totalCategories = 6;
    let completedCategories = 0;

    const sendCategory = (categoryName: string, count: number) => {
      completedCategories++;
      send('progress', completedCategories, totalCategories, `Sincronizando ${categoryName}: ${count} documentos`, categoryName);
    };

    try {
      const allDocs: Array<{ content: string; metadata: Record<string, any> }> = [];

      const company = await this.prisma.company.findUnique({ where: { id: companyId } });
      if (company) {
        allDocs.push({
          content: `Veterinaria: ${company.name}. Dirección: ${company.address || 'No especificada'}. Teléfono: ${company.phone || 'No especificado'}. Email: ${company.email || 'No especificado'}.`,
          metadata: { source: 'company', type: 'company' }
        });
        results.company = true;
      }
      sendCategory('Empresa', 1);

      const clients = await this.prisma.client.findMany({ where: { companyId } });
      results.clients = clients.length;
      if (clients.length > 0) {
        for (const c of clients) {
          allDocs.push({
            content: `Cliente ${c.name} ${c.lastName || ''} | DNI ${c.dni || 'ND'} | email ${c.email || 'ND'} | tel ${c.phone || 'ND'} | dir ${c.address || 'ND'}`,
            metadata: { source: 'client', clientId: c.id, name: c.name }
          });
        }
      }
      sendCategory('Clientes', clients.length);

      const pets = await this.prisma.pet.findMany({ 
        where: { companyId },
        include: { client: true }
      });
      results.pets = pets.length;
      if (pets.length > 0) {
        for (const p of pets) {
          const ownerName = p.client?.name || 'N/A';
          let ageText = 'N/A';
          if (p.birthDate) {
            const ageMs = Date.now() - p.birthDate.getTime();
            ageText = Math.floor(ageMs / (365.25 * 24 * 60 * 60 * 1000)) + ' años';
          }
          allDocs.push({
            content: `Mascota ${p.name} | especie ${p.species} | raza ${p.breed || 'ND'} | peso ${p.weight || 'ND'}kg | edad ${ageText} | dueño ${ownerName} | notas ${p.notes || 'sin notas'}`,
            metadata: { source: 'pet', petId: p.id, name: p.name }
          });
        }
      }
      sendCategory('Mascotas', pets.length);

      const supplies = await this.prisma.supply.findMany({ where: { companyId } });
      results.supplies = supplies.length;
      if (supplies.length > 0) {
        for (const s of supplies) {
          allDocs.push({
            content: `${s.name} | marca ${s.brand || 'ND'} | stock ${s.quantity} ${s.unit || 'unidades'} | precio $${s.unitPrice} | stock min ${s.minQuantity || 10}`,
            metadata: { source: 'supply', supplyId: s.id, name: s.name, quantity: s.quantity }
          });
        }
      }
      sendCategory('Insumos', supplies.length);

      const prices = await this.prisma.priceItem.findMany({ where: { companyId } });
      results.prices = prices.length;
      if (prices.length > 0) {
        for (const p of prices) {
          allDocs.push({
            content: `Precio: ${p.name}. Categoría: ${p.category || 'N/A'}. Precio: $${p.price}. Descripción: ${p.description || 'N/A'}.`,
            metadata: { source: 'price', priceId: p.id, name: p.name }
          });
        }
      }
      sendCategory('Precios', prices.length);

      const medicalRecords = await this.prisma.medicalRecord.findMany({
        where: { pet: { companyId } },
        include: { pet: true },
        take: 100,
      });
      results.medicalRecords = medicalRecords.length;
      if (medicalRecords.length > 0) {
        for (const r of medicalRecords) {
          allDocs.push({
            content: `Historia médica de ${r.pet?.name || 'mascota'}. Fecha: ${r.date}. Motivo: ${r.visitReason}. Diagnóstico: ${r.diagnosis || 'N/A'}. Tratamiento: ${r.treatment || 'N/A'}. Observaciones: ${r.observations || 'Sin observaciones'}.`,
            metadata: { source: 'medicalrecord', recordId: r.id, petId: r.petId, date: r.date }
          });
        }
      }
      sendCategory('Historiales médicos', medicalRecords.length);

      if (allDocs.length > 0) {
        await this.aiProxy.sendToRag(companyId, allDocs, (p) => {
          send(p.type, p.current, p.total, p.message, 'all');
        });
      }

      this.logger.log(`RAG ingestion completed for company ${companyId}: ${JSON.stringify(results)} (${allDocs.length} total docs)`);
      return { success: true, ingested: results };

    } catch (error) {
      this.logger.error(`Error in RAG ingestion: ${error.message}`);
      throw error;
    }
  }
}
