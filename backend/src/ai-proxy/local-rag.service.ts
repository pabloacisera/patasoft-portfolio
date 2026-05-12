import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { Chroma } from '@langchain/community/vectorstores/chroma';
import { GoogleGenerativeAIEmbeddings } from '@langchain/google-genai';
import Groq from 'groq-sdk';

export type ProgressCallback = (data: { type: string; current: number; total: number; message: string }) => void;

@Injectable()
export class LocalRagService implements OnModuleInit {
  private readonly logger = new Logger(LocalRagService.name);
  private isInitialized = false;
  private chromaUrl: string;
  private embeddings: GoogleGenerativeAIEmbeddings;
  private groq: Groq;

  constructor(
    private config: ConfigService,
    private prisma: PrismaService,
  ) {}

  async onModuleInit() {
    try {
      this.chromaUrl = this.config.get('CHROMA_URL') || 'http://localhost:8000';
      this.groq = new Groq({ apiKey: this.config.get('GROQ_API_KEY') });
      this.embeddings = new GoogleGenerativeAIEmbeddings({
        apiKey: this.config.get('GEMINI_API_KEY'),
        modelName: 'gemini-embedding-001',
      });
      this.isInitialized = true;
      this.logger.log(`✅ Local RAG service initialized (Chroma at ${this.chromaUrl})`);
    } catch (error) {
      this.logger.warn(`⚠️ Local RAG init failed: ${error.message}`);
      this.isInitialized = false;
    }
  }

  private getCollectionName(companyId: string): string {
    return `company_${companyId}`;
  }

  async addDocuments(companyId: string, documents: any[], progressCallback?: ProgressCallback) {
    if (!this.isInitialized) {
      this.logger.warn('RAG no inicializado, ignorando documentos');
      if (progressCallback) progressCallback({ type: 'error', current: 0, total: documents.length, message: 'RAG no inicializado' });
      return { added: 0, status: 'skipped' };
    }

    const docs = documents.map(doc => ({
      pageContent: doc.content,
      metadata: { ...doc.metadata, companyId },
    }));

    const BATCH_SIZE = 5;
    const DELAY_MS = 400;
    const MAX_RETRIES = 3;
    let totalAdded = 0;
    let totalFailed = 0;
    let batchNum = 0;

    progressCallback?.({ type: 'start', current: 0, total: docs.length, message: `Iniciando sync: ${docs.length} documentos` });

    for (let i = 0; i < docs.length; i += BATCH_SIZE) {
      batchNum++;
      const batch = docs.slice(i, i + BATCH_SIZE);
      const batchEnd = Math.min(i + BATCH_SIZE, docs.length);
      let attempt = 0;
      let success = false;

      while (attempt < MAX_RETRIES && !success) {
        attempt++;
        try {
          progressCallback?.({ 
            type: 'progress', 
            current: i, 
            total: docs.length, 
            message: attempt > 1 
              ? `Retry lote ${batchNum} (intento ${attempt}/${MAX_RETRIES}) - ${batchEnd}/${docs.length}...` 
              : `Procesando lote ${batchNum} (${batchEnd}/${docs.length})...`
          });

          await Chroma.fromDocuments(batch, this.embeddings, {
            collectionName: this.getCollectionName(companyId),
            url: this.chromaUrl,
          });
          
          success = true;
          totalAdded += batch.length;

        } catch (error) {
          if (attempt >= MAX_RETRIES) {
            this.logger.error(`Lote ${batchNum} falló definitivamente después de ${MAX_RETRIES} intentos: ${error.message}`);
            totalFailed += batch.length;
            progressCallback?.({ 
              type: 'error_batch', 
              current: batchEnd, 
              total: docs.length, 
              message: `Lote ${batchNum} falló: ${error.message}` 
            });
          } else {
            this.logger.warn(`Lote ${batchNum} error intento ${attempt}: ${error.message}. Reintentando...`);
            const backoff = DELAY_MS * Math.pow(2, attempt - 1);
            await new Promise(r => setTimeout(r, backoff));
          }
        }
      }

      if (batchEnd < docs.length) {
        await new Promise(r => setTimeout(r, DELAY_MS));
      }
    }

    const verify = await Chroma.fromExistingCollection(this.embeddings, {
      collectionName: this.getCollectionName(companyId),
      url: this.chromaUrl,
    });
    const verified = (await verify.similaritySearch('insumo', 500)).length;

    progressCallback?.({ 
      type: 'complete', 
      current: docs.length, 
      total: docs.length, 
      message: totalFailed > 0 
        ? `Sync completado: ${totalAdded} docs agregados, ${totalFailed} fallidos, ${verified} verificados` 
        : `Sync completado: ${totalAdded} docs agregados, ${verified} verificados`
    });

    this.logger.log(`RAG addDocuments completado: ${totalAdded} agregados, ${totalFailed} fallidos, ${verified} verificados`);
    return { added: totalAdded, failed: totalFailed, verified, status: totalFailed > 0 ? 'partial' : 'success' };
  }

  async query(companyId: string, message: string, history: any[] = []) {
    const model = this.config.get('GROQ_MODEL_DEFAULT') || 'llama-3.3-70b-versatile';

    let context = '';
    if (this.isInitialized) {
      try {
        const vectorStore = await Chroma.fromExistingCollection(this.embeddings, {
          collectionName: this.getCollectionName(companyId),
          url: this.chromaUrl,
        });
        const results = await vectorStore.similaritySearch(message, 15);
        if (results.length > 0) {
          context = results.map(r => r.pageContent).join('\n\n');
          this.logger.log(`RAG encontró ${results.length} documentos para company ${companyId}`);
        }
      } catch (error) {
        this.logger.warn(`RAG sin contexto para ${companyId}: ${error.message}`);
      }
    }

    const systemPrompt = context
      ? `SOS UN ASISTENTE VETERINARIO. Tu trabajo es responder preguntas sobre los datos de la veterinaria que administrás.\n\nDATOS DE LA VETERINARIA:\n${context}\n\nINSTRUCCIONES:\n- Leé TODOS los datos proporcionados arriba antes de responder.\n- Si la pregunta es sobre inventory/stock/cantidad/precio de algo, buscá esa información específica en los datos.\n- Nombrá exactamente qué productos/cantidades encontraste en los datos.\n- Si no hay información en los datos, decilo claramente: "No tengo esa información en los datos de la veterinaria."\n- NO inventes información que no esté en los datos.\n- Respondé en español argentino, de forma clara y directa.`
      : `Sos un asistente veterinario especializado. Respondé preguntas sobre medicina veterinaria, animales y cuidado de mascotas en español argentino.`;

    const messages: any[] = [{ role: 'system', content: systemPrompt }];

    if (Array.isArray(history)) {
      for (const h of history) {
        if (h.role && h.content) messages.push({ role: h.role, content: h.content });
      }
    }
    messages.push({ role: 'user', content: message });

    const completion = await this.groq.chat.completions.create({
      model,
      messages,
      max_tokens: 1024,
      temperature: 0.7,
    });

    const answer = completion.choices[0]?.message?.content || 'Sin respuesta';
    return {
      message: { role: 'assistant', content: answer },
      response: answer,
      hasContext: !!context
    };
  }

  async *queryStream(companyId: string, message: string, history: any[] = []) {
    const model = this.config.get('GROQ_MODEL_DEFAULT') || 'llama-3.3-70b-versatile';

    let context = '';
    if (this.isInitialized && this.groq) {
      try {
        const vectorStore = await Chroma.fromExistingCollection(this.embeddings, {
          collectionName: this.getCollectionName(companyId),
          url: this.chromaUrl,
        });
        const results = await vectorStore.similaritySearch(message, 15);
        if (results.length > 0) {
          context = results.map(r => r.pageContent).join('\n\n');
          this.logger.log(`RAG stream encontró ${results.length} documentos para company ${companyId}`);
        }
      } catch (error) {
        this.logger.warn(`RAG stream sin contexto para ${companyId}: ${error.message}`);
      }
    }

    const systemPrompt = context
      ? `SOS UN ASISTENTE VETERINARIO. Tu trabajo es responder preguntas sobre los datos de la veterinaria que administrás.\n\nDATOS DE LA VETERINARIA:\n${context}\n\nINSTRUCCIONES:\n- Leé TODOS los datos proporcionados arriba antes de responder.\n- Si la pregunta es sobre inventory/stock/cantidad/precio de algo, buscá esa información específica en los datos.\n- Nombrá exactamente qué productos/cantidades encontraste en los datos.\n- Si no hay información en los datos, decilo claramente: "No tengo esa información en los datos de la veterinaria."\n- NO inventes información que no esté en los datos.\n- Respondé en español argentino, de forma clara y directa.`
      : `Sos un asistente veterinario especializado. Respondé preguntas sobre medicina veterinaria, animales y cuidado de mascotas en español argentino.`;

    const messages: any[] = [{ role: 'system', content: systemPrompt }];

    if (Array.isArray(history)) {
      for (const h of history) {
        if (h.role && h.content) messages.push({ role: h.role, content: h.content });
      }
    }
    messages.push({ role: 'user', content: message });

    if (!this.groq) {
      this.logger.error('Groq client no inicializado');
      return;
    }

    const stream = await this.groq.chat.completions.create({
      model,
      messages,
      max_tokens: 1024,
      temperature: 0.7,
      stream: true,
    });

    for await (const chunk of stream) {
      const text = chunk.choices[0]?.delta?.content || '';
      if (text) yield text;
    }
  }
}
