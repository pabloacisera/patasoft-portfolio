import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AiProxyService } from './ai-proxy.service';

@Injectable()
export class RagIngestionService {
  private readonly logger = new Logger(RagIngestionService.name);

  constructor(
    private prisma: PrismaService,
    private aiProxy: AiProxyService,
  ) {}

  async ingestCompanyData(companyId: string) {
    const results = {
      clients: 0,
      pets: 0,
      supplies: 0,
      medicalRecords: 0,
      prices: 0,
      company: false,
    };

    try {
      // 1. Datos de la empresa
      const company = await this.prisma.company.findUnique({ where: { id: companyId } });
      if (company) {
        const companyDoc = {
          content: `Veterinaria: ${company.name}. Dirección: ${company.address || 'No especificada'}. Teléfono: ${company.phone || 'No especificado'}. Email: ${company.email || 'No especificado'}.`,
          metadata: { source: 'company', type: 'company' }
        };
        await this.aiProxy.sendToRag(companyId, [companyDoc]);
        results.company = true;
      }

      // 2. Clientes
      const clients = await this.prisma.client.findMany({ where: { companyId } });
      results.clients = clients.length;
      if (clients.length > 0) {
        const clientDocs = clients.map(c => ({
          content: `Cliente: ${c.name}. DNI: ${c.dni || 'N/A'}. Email: ${c.email || 'N/A'}. Teléfono: ${c.phone || 'N/A'}. Dirección: ${c.address || 'N/A'}.`,
          metadata: { source: 'client', clientId: c.id, name: c.name }
        }));
        await this.aiProxy.sendToRag(companyId, clientDocs);
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
        await this.aiProxy.sendToRag(companyId, petDocs);
      }

      // 4. Insumos/Stock
      const supplies = await this.prisma.supply.findMany({ where: { companyId } });
      results.supplies = supplies.length;
      if (supplies.length > 0) {
        const supplyDocs = supplies.map(s => ({
          content: `Insumo: ${s.name}. Marca: ${s.brand || 'N/A'}. Cantidad: ${s.quantity}. Unidad: ${s.unit || 'unidad'}. Precio: $${s.unitPrice}. Stock mínimo: ${s.minQuantity || 10}.`,
          metadata: { source: 'supply', supplyId: s.id, name: s.name }
        }));
        await this.aiProxy.sendToRag(companyId, supplyDocs);
      }

      // 5. Precios actuales
      const prices = await this.prisma.priceItem.findMany({ where: { companyId } });
      results.prices = prices.length;
      if (prices.length > 0) {
        const priceDocs = prices.map(p => ({
          content: `Precio: ${p.name}. Categoría: ${p.category || 'N/A'}. Precio: $${p.price}. Descripción: ${p.description || 'N/A'}.`,
          metadata: { source: 'price', priceId: p.id, name: p.name }
        }));
        await this.aiProxy.sendToRag(companyId, priceDocs);
      }

      // 6. Historiales médicos (últimos 100)
      const medicalRecords = await this.prisma.medicalRecord.findMany({
        where: { pet: { companyId } },
        include: { pet: true },
        take: 100,
      });
      results.medicalRecords = medicalRecords.length;
      if (medicalRecords.length > 0) {
        const recordDocs = medicalRecords.map(r => ({
          content: `Historia médica de ${r.pet?.name || 'mascota'}. Fecha: ${r.date}. Motivo: ${r.visitReason}. Diagnóstico: ${r.diagnosis || 'N/A'}. Tratamiento: ${r.treatment || 'N/A'}. Observaciones: ${r.observations || 'Sin observaciones'}.`,
          metadata: { source: 'medicalrecord', recordId: r.id, petId: r.petId, date: r.date }
        }));
        await this.aiProxy.sendToRag(companyId, recordDocs);
      }

      this.logger.log(`RAG ingestion completed for company ${companyId}: ${JSON.stringify(results)}`);
      return { success: true, ingested: results };

    } catch (error) {
      this.logger.error(`Error in RAG ingestion: ${error.message}`);
      throw error;
    }
  }
}
