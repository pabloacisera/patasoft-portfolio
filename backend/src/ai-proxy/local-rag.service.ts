import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { GoogleGenAI } from '@google/genai';
import { Pool } from 'pg';
import Groq from 'groq-sdk';

export type ProgressCallback = (data: { type: string; current: number; total: number; message: string }) => void;

@Injectable()
export class LocalRagService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(LocalRagService.name);
  private isInitialized = false;
  private ai: GoogleGenAI;
  private groq: Groq;
  private pool: Pool;

  constructor(
    private config: ConfigService,
    private prisma: PrismaService,
  ) {}

  async onModuleInit() {
    try {
      this.groq = new Groq({ apiKey: this.config.get('GROQ_API_KEY') });
      this.ai = new GoogleGenAI({ apiKey: this.config.get('GEMINI_API_KEY') });
      this.pool = new Pool({ connectionString: this.config.get('DATABASE_URL') });
      this.isInitialized = true;
      this.logger.log('✅ Local RAG service initialized (pgvector)');
    } catch (error) {
      this.logger.warn(`⚠️ Local RAG init failed: ${error.message}`);
      this.isInitialized = false;
    }
  }

  async onModuleDestroy() {
    if (this.pool) await this.pool.end();
  }

  private async embed(text: string): Promise<number[]> {
    const res = await this.ai.models.embedContent({
      model: 'gemini-embedding-2-preview',
      contents: text,
      config: { outputDimensionality: 768 },
    });
    return Array.from(res.embeddings?.[0]?.values ?? []);
  }

  async addDocuments(companyId: number, documents: any[], progressCallback?: ProgressCallback) {
    if (!this.isInitialized) {
      progressCallback?.({ type: 'error', current: 0, total: documents.length, message: 'RAG no inicializado' });
      return { added: 0, status: 'skipped' };
    }

    const BATCH_SIZE = 5;
    const DELAY_MS = 400;
    const MAX_RETRIES = 3;
    let totalAdded = 0;
    let totalFailed = 0;
    let batchNum = 0;

    progressCallback?.({ type: 'start', current: 0, total: documents.length, message: `Iniciando sync: ${documents.length} documentos` });

    const client = await this.pool.connect();
    try {
      await client.query('DELETE FROM langchain_vectors WHERE company_id = $1', [companyId]);
    } finally {
      client.release();
    }

    for (let i = 0; i < documents.length; i += BATCH_SIZE) {
      batchNum++;
      const batch = documents.slice(i, i + BATCH_SIZE);
      const batchEnd = Math.min(i + BATCH_SIZE, documents.length);
      let attempt = 0;
      let success = false;

      while (attempt < MAX_RETRIES && !success) {
        attempt++;
        try {
          progressCallback?.({
            type: 'progress',
            current: i,
            total: documents.length,
            message: attempt > 1
              ? `Retry lote ${batchNum} (intento ${attempt}/${MAX_RETRIES}) - ${batchEnd}/${documents.length}...`
              : `Procesando lote ${batchNum} (${batchEnd}/${documents.length})...`,
          });

          for (const doc of batch) {
            const embedding = await this.embed(doc.content);
            const metadata = { ...doc.metadata, companyId };
            const c = await this.pool.connect();
            try {
              await c.query(
                `INSERT INTO langchain_vectors (content, metadata, embedding, company_id)
                 VALUES ($1, $2, $3::vector, $4)`,
                [doc.content, JSON.stringify(metadata), '[' + embedding.join(',') + ']', companyId]
              );
            } finally {
              c.release();
            }
          }

          success = true;
          totalAdded += batch.length;
        } catch (error) {
          if (attempt >= MAX_RETRIES) {
            totalFailed += batch.length;
            progressCallback?.({ type: 'error_batch', current: batchEnd, total: documents.length, message: `Lote ${batchNum} falló: ${error.message}` });
          } else {
            await new Promise(r => setTimeout(r, DELAY_MS * Math.pow(2, attempt - 1)));
          }
        }
      }

      if (batchEnd < documents.length) await new Promise(r => setTimeout(r, DELAY_MS));
    }

    const vc = await this.pool.connect();
    let verified = 0;
    try {
      const result = await vc.query('SELECT COUNT(*) FROM langchain_vectors WHERE company_id = $1', [companyId]);
      verified = parseInt(result.rows[0].count, 10);
    } finally {
      vc.release();
    }

    progressCallback?.({
      type: 'complete',
      current: documents.length,
      total: documents.length,
      message: `Sync completado: ${totalAdded} docs agregados, ${totalFailed} fallidos, ${verified} verificados`,
    });

    return { added: totalAdded, failed: totalFailed, verified, status: totalFailed > 0 ? 'partial' : 'success' };
  }

  async countDocuments(companyId: number): Promise<number> {
    if (!this.isInitialized) return 0;
    const client = await this.pool.connect();
    try {
      const res = await client.query('SELECT COUNT(*)::int AS count FROM langchain_vectors WHERE company_id = $1', [companyId]);
      return res.rows[0]?.count ?? 0;
    } finally {
      client.release();
    }
  }

  async upsertEmbedding(companyId: number, content: string, metadata: Record<string, any>) {
    if (!this.isInitialized) return;
    try {
      const embedding = await this.embed(content);
      const meta = { ...metadata, companyId };

      const conditions: string[] = ['company_id = $1'];
      const params: any[] = [companyId];
      let idx = 2;

      const idKeys = ['clientId', 'petId', 'supplyId', 'priceId', 'recordId', 'id'];
      for (const key of idKeys) {
        if (metadata[key]) {
          conditions.push(`metadata->>'${key}' = $${idx}`);
          params.push(String(metadata[key]));
          idx++;
        }
      }

      const c = await this.pool.connect();
      try {
        await c.query(`DELETE FROM langchain_vectors WHERE ${conditions.join(' AND ')}`, params);
        await c.query(
          `INSERT INTO langchain_vectors (content, metadata, embedding, company_id)
           VALUES ($1, $2, $3::vector, $4)`,
          [content, JSON.stringify(meta), '[' + embedding.join(',') + ']', companyId]
        );
      } finally {
        c.release();
      }

      this.logger.log(`Embedding upserted for company ${companyId} (source: ${metadata.source})`);
    } catch (error) {
      this.logger.error(`upsertEmbedding failed for company ${companyId} (source: ${metadata.source}): ${error.message}`);
    }
  }

  async deleteEmbedding(companyId: number, metadata: Record<string, any>) {
    if (!this.isInitialized) return;
    try {
      const conditions: string[] = ['company_id = $1'];
      const params: any[] = [companyId];
      let idx = 2;

      const idKeys = ['clientId', 'petId', 'supplyId', 'priceId', 'recordId', 'id'];
      for (const key of idKeys) {
        if (metadata[key]) {
          conditions.push(`metadata->>'${key}' = $${idx}`);
          params.push(String(metadata[key]));
          idx++;
        }
      }

      const c = await this.pool.connect();
      try {
        await c.query(`DELETE FROM langchain_vectors WHERE ${conditions.join(' AND ')}`, params);
      } finally {
        c.release();
      }

      this.logger.log(`Embedding deleted for company ${companyId} (source: ${metadata.source})`);
    } catch (error) {
      this.logger.error(`deleteEmbedding failed for company ${companyId} (source: ${metadata.source}): ${error.message}`);
    }
  }

  private async similaritySearch(companyId: number, query: string, k = 15): Promise<string[]> {
    const embedding = await this.embed(query);
    const vectorStr = '[' + embedding.join(',') + ']';
    const client = await this.pool.connect();
    try {
      const result = await client.query(
        `SELECT content FROM langchain_vectors
         WHERE company_id = $1
         ORDER BY embedding <=> $2::vector
         LIMIT $3`,
        [companyId, vectorStr, k]
      );
      return result.rows.map(r => r.content);
    } finally {
      client.release();
    }
  }

  async query(companyId: number, message: string, history: any[] = []) {
    const model = this.config.get('GROQ_MODEL_DEFAULT') || 'llama-3.3-70b-versatile';
    let context = '';

    if (this.isInitialized) {
      try {
        const results = await this.similaritySearch(companyId, message);
        if (results.length > 0) {
          context = results.join('\n\n');
          this.logger.log(`RAG encontró ${results.length} documentos para company ${companyId}`);
        }
      } catch (error) {
        this.logger.warn(`RAG sin contexto para ${companyId}: ${error.message}`);
      }
    }

    const systemPrompt = context
      ? `SOS UN ASISTENTE VETERINARIO. Tu trabajo es responder preguntas sobre los datos de la veterinaria que administrás.\n\nDATOS DE LA VETERINARIA:\n${context}\n\nINSTRUCCIONES:\n- Leé TODOS los datos proporcionados arriba antes de responder.\n- Si la pregunta es sobre inventory/stock/cantidad/precio de algo, buscá esa información específica en los datos.\n- Nombrá exactamente qué productos/cantidades encontraste en los datos.\n- Si no hay información en los datos sobre stock/precios/procedimientos registrados, decilo claramente: "No tengo esa información en los datos de la veterinaria."\n- NO inventes información que no esté en los datos.\n- Respondé en español argentino, de forma clara y directa.\n- IMPORTANTE: Si la consulta es CLÍNICA (síntomas, diagnóstico, tratamiento, pronóstico): NUNCA digas "no sé" ni "no tengo información". En su lugar, indicá qué estudios complementarios solicitar (hemograma, bioquímica, Rx, ecografía, etc.), qué preguntas hacer al tutor, o qué pasos de diagnóstico diferencial seguir.`
      : `Sos un asistente veterinario especializado. Respondé preguntas sobre medicina veterinaria, animales y cuidado de mascotas en español argentino.\n\nIMPORTANTE: Si la consulta es CLÍNICA (síntomas, diagnóstico, tratamiento, pronóstico): NUNCA digas "no sé" ni "no tengo información". En su lugar, indicá qué estudios complementarios solicitar (hemograma, bioquímica, Rx, ecografía, etc.), qué preguntas hacer al tutor, o qué pasos de diagnóstico diferencial seguir. No uses frases como "como veterinario con X años de experiencia".`;

    const messages: any[] = [{ role: 'system', content: systemPrompt }];
    if (Array.isArray(history)) {
      for (const h of history) {
        if (h.role && h.content) messages.push({ role: h.role, content: h.content });
      }
    }
    messages.push({ role: 'user', content: message });

    const completion = await this.groq.chat.completions.create({ model, messages, max_tokens: 1024, temperature: 0.7 });
    const answer = completion.choices[0]?.message?.content || 'Sin respuesta';
    return { message: { role: 'assistant', content: answer }, response: answer, hasContext: !!context };
  }

  async *queryStream(companyId: number, message: string, history: any[] = []) {
    const model = this.config.get('GROQ_MODEL_DEFAULT') || 'llama-3.3-70b-versatile';
    let context = '';

    if (this.isInitialized && this.groq) {
      try {
        const results = await this.similaritySearch(companyId, message);
        if (results.length > 0) {
          context = results.join('\n\n');
          this.logger.log(`RAG stream encontró ${results.length} documentos para company ${companyId}`);
        }
      } catch (error) {
        this.logger.warn(`RAG stream sin contexto para ${companyId}: ${error.message}`);
      }
    }

    const systemPrompt = context
      ? `SOS UN ASISTENTE VETERINARIO. Tu trabajo es responder preguntas sobre los datos de la veterinaria que administrás.\n\nDATOS DE LA VETERINARIA:\n${context}\n\nINSTRUCCIONES:\n- Leé TODOS los datos proporcionados arriba antes de responder.\n- Si la pregunta es sobre inventory/stock/cantidad/precio de algo, buscá esa información específica en los datos.\n- Nombrá exactamente qué productos/cantidades encontraste en los datos.\n- Si no hay información en los datos sobre stock/precios/procedimientos registrados, decilo claramente: "No tengo esa información en los datos de la veterinaria."\n- NO inventes información que no esté en los datos.\n- Respondé en español argentino, de forma clara y directa.\n- IMPORTANTE: Si la consulta es CLÍNICA (síntomas, diagnóstico, tratamiento, pronóstico): NUNCA digas "no sé" ni "no tengo información". En su lugar, indicá qué estudios complementarios solicitar (hemograma, bioquímica, Rx, ecografía, etc.), qué preguntas hacer al tutor, o qué pasos de diagnóstico diferencial seguir.`
      : `Sos un asistente veterinario especializado. Respondé preguntas sobre medicina veterinaria, animales y cuidado de mascotas en español argentino.\n\nIMPORTANTE: Si la consulta es CLÍNICA (síntomas, diagnóstico, tratamiento, pronóstico): NUNCA digas "no sé" ni "no tengo información". En su lugar, indicá qué estudios complementarios solicitar (hemograma, bioquímica, Rx, ecografía, etc.), qué preguntas hacer al tutor, o qué pasos de diagnóstico diferencial seguir. No uses frases como "como veterinario con X años de experiencia".`;

    const messages: any[] = [{ role: 'system', content: systemPrompt }];
    if (Array.isArray(history)) {
      for (const h of history) {
        if (h.role && h.content) messages.push({ role: h.role, content: h.content });
      }
    }
    messages.push({ role: 'user', content: message });

    const stream = await this.groq.chat.completions.create({ model, messages, max_tokens: 1024, temperature: 0.7, stream: true });
    for await (const chunk of stream) {
      const text = chunk.choices[0]?.delta?.content || '';
      if (text) yield text;
    }
  }
}
