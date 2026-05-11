import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { Chroma } from '@langchain/community/vectorstores/chroma';
import { GoogleGenerativeAIEmbeddings, ChatGoogleGenerativeAI } from '@langchain/google-genai';

@Injectable()
export class LocalRagService implements OnModuleInit {
  private readonly logger = new Logger(LocalRagService.name);
  private vectorStore: Chroma | null = null;
  private isInitialized = false;

  constructor(
    private config: ConfigService,
    private prisma: PrismaService,
  ) {}

  async onModuleInit() {
    try {
      const embeddings = new GoogleGenerativeAIEmbeddings({
        apiKey: this.config.get('GEMINI_API_KEY') || process.env.GEMINI_API_KEY,
      });

      const chromaUrl = this.config.get('CHROMA_URL') || 'http://localhost:8000';
      
      this.vectorStore = await Chroma.fromExistingCollection(embeddings, {
        collectionName: 'local-rag',
        url: chromaUrl,
      });

      this.isInitialized = true;
      this.logger.log(`✅ Local RAG service initialized (LangChain.js + Chroma at ${chromaUrl})`);
    } catch (error) {
      this.logger.error(`❌ Local RAG initialization failed: ${error.message}`);
      this.isInitialized = false;
    }
  }

  async addDocuments(companyId: string, documents: any[]) {
    if (!this.isInitialized || !this.vectorStore) {
      throw new Error('Local RAG not initialized');
    }

    try {
      const docs = documents.map(doc => ({
        pageContent: doc.content,
        metadata: {
          ...doc.metadata,
          companyId, // CRITICAL: always enforce companyId
        },
      }));

      await this.vectorStore.addDocuments(docs);
      this.logger.log(`Added ${docs.length} documents for company ${companyId}`);
      return { added: docs.length, status: 'success' };
    } catch (error) {
      this.logger.error(`Error adding documents: ${error.message}`);
      throw error;
    }
  }

  async query(companyId: string, query: string, topK: number = 5) {
    if (!this.isInitialized || !this.vectorStore) {
      return { answer: 'Local RAG not available', sources: [] };
    }

    try {
      // Search with companyId filter using Chroma's metadata syntax
      const results = await this.vectorStore.similaritySearch(query, topK, {
        companyId: companyId,
      });

      if (!results.length) {
        return { answer: 'No relevant documents found', sources: [] };
      }

      const context = results.map(r => r.pageContent).join('\n\n');
      
      // Use Google Generative AI for response
      const model = new ChatGoogleGenerativeAI({
        model: 'gemini-1.5-flash',
        apiKey: this.config.get('GEMINI_API_KEY'),
      });

      const prompt = `Based EXCLUSIVELY on the following documents from company ${companyId}:
      
${context}

Question: ${query}

Answer:`;

      const response = await model.invoke(prompt);

      return {
        answer: response.content,
        sources: results.map(r => ({
          content: r.pageContent.substring(0, 300),
          metadata: r.metadata,
        })),
      };
    } catch (error) {
      this.logger.error(`Query error: ${error.message}`);
      return { answer: `Error: ${error.message}`, sources: [] };
    }
  }
}
