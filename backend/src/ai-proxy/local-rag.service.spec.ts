import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LocalRagService } from './local-rag.service';

describe('LocalRagService', () => {
  let service: LocalRagService;
  let mockConfig: any;
  let mockPrisma: any;
  let mockPool: any;
  let mockClient: any;

  const companyId = 'company-1';

  beforeEach(() => {
    mockConfig = {
      get: vi.fn().mockImplementation((key: string) => {
        const values: Record<string, string> = {
          GROQ_API_KEY: 'test-groq-key',
          GEMINI_API_KEY: 'test-gemini-key',
          DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
        };
        return values[key];
      }),
    };
    mockPrisma = {};
    mockClient = {
      query: vi.fn().mockResolvedValue({ rows: [{ count: '1' }] }),
      release: vi.fn(),
    };
    mockPool = {
      connect: vi.fn().mockResolvedValue(mockClient),
      end: vi.fn(),
      query: vi.fn().mockResolvedValue({ rows: [] }),
    };

    service = new LocalRagService(mockConfig, mockPrisma);
    (service as any).pool = mockPool;
    (service as any).isInitialized = true;
    (service as any).ai = {
      models: {
        embedContent: vi.fn().mockResolvedValue({
          embeddings: [{ values: new Array(768).fill(0.1) }],
        }),
      },
    };
    (service as any).groq = {
      chat: {
        completions: {
          create: vi.fn().mockResolvedValue({
            choices: [{ message: { content: 'Respuesta del LLM' } }],
          }),
        },
      },
    };
  });

  describe('addDocuments', () => {
    it('should return skipped if not initialized', async () => {
      (service as any).isInitialized = false;
      const callback = vi.fn();

      const result = await service.addDocuments(companyId, [{ content: 'test', metadata: {} }], callback);

      expect(result.status).toBe('skipped');
      expect(callback).toHaveBeenCalledWith(expect.objectContaining({ type: 'error' }));
    });

    it('should delete existing vectors before adding new ones', async () => {
      const docs = [{ content: 'test doc', metadata: { source: 'test' } }];

      await service.addDocuments(companyId, docs);

      expect(mockClient.query).toHaveBeenCalledWith(
        'DELETE FROM langchain_vectors WHERE company_id = $1',
        [companyId],
      );
    });

    it('should insert embeddings for each document', async () => {
      const docs = [
        { content: 'doc 1', metadata: { source: 'test' } },
        { content: 'doc 2', metadata: { source: 'test' } },
      ];

      await service.addDocuments(companyId, docs);

      expect((service as any).ai.models.embedContent).toHaveBeenCalledTimes(2);
    });

    it('should report progress via callback', async () => {
      const callback = vi.fn();
      const docs = [{ content: 'doc 1', metadata: {} }];

      await service.addDocuments(companyId, docs, callback);

      expect(callback).toHaveBeenCalledWith(expect.objectContaining({ type: 'start' }));
      expect(callback).toHaveBeenCalledWith(expect.objectContaining({ type: 'progress' }));
    });

    it('should retry failed batches up to MAX_RETRIES', async () => {
      let callCount = 0;
      (service as any).ai.models.embedContent.mockImplementation(() => {
        callCount++;
        if (callCount === 1) throw new Error('API error');
        return Promise.resolve({ embeddings: [{ values: new Array(768).fill(0.1) }] });
      });

      const docs = [{ content: 'doc 1', metadata: {} }];
      const callback = vi.fn();

      await service.addDocuments(companyId, docs, callback);

      expect(callCount).toBeGreaterThanOrEqual(2);
    });
  });

  describe('upsertEmbedding', () => {
    it('should generate embedding and insert into pgvector', async () => {
      await service.upsertEmbedding(companyId, 'test content', { source: 'test' });

      expect((service as any).ai.models.embedContent).toHaveBeenCalledWith({
        model: 'gemini-embedding-2-preview',
        contents: 'test content',
        config: { outputDimensionality: 768 },
      });
    });

    it('should not throw if not initialized', async () => {
      (service as any).isInitialized = false;

      await expect(service.upsertEmbedding(companyId, 'test', {})).resolves.not.toThrow();
    });

    it('should not throw and log error when embed() fails', async () => {
      (service as any).ai.models.embedContent.mockRejectedValueOnce(new Error('Gemini down'));
      const loggerErrorSpy = vi.spyOn(service['logger'], 'error');

      await expect(service.upsertEmbedding(companyId, 'test content', { source: 'test' })).resolves.not.toThrow();

      expect(loggerErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('upsertEmbedding failed for company')
      );
    });

    it('should not throw and log error when DB query fails', async () => {
      mockClient.query.mockRejectedValueOnce(new Error('DB connection failed'));
      const loggerErrorSpy = vi.spyOn(service['logger'], 'error');

      await expect(service.upsertEmbedding(companyId, 'test content', { source: 'test' })).resolves.not.toThrow();

      expect(loggerErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('upsertEmbedding failed for company')
      );
    });
  });

  describe('deleteEmbedding', () => {
    it('should delete vectors matching metadata', async () => {
      await service.deleteEmbedding(companyId, { source: 'client', clientId: '123' });

      expect(mockClient.query).toHaveBeenCalled();
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should not throw if not initialized', async () => {
      (service as any).isInitialized = false;

      await expect(service.deleteEmbedding(companyId, { source: 'test' })).resolves.not.toThrow();
    });

    it('should not throw and log error when DB query fails', async () => {
      mockClient.query.mockRejectedValueOnce(new Error('DB connection failed'));
      const loggerErrorSpy = vi.spyOn(service['logger'], 'error');

      await expect(service.deleteEmbedding(companyId, { source: 'test' })).resolves.not.toThrow();

      expect(loggerErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('deleteEmbedding failed for company')
      );
    });
  });

  describe('query', () => {
    it('should return response from LLM with context', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [{ content: 'Contexto relevante sobre la veterinaria' }],
      });

      const result = await service.query(companyId, '¿Cuántas mascotas tengo?');

      expect(result).toBeDefined();
      expect((service as any).groq.chat.completions.create).toHaveBeenCalled();
    });

    it('should return response without context when no similar documents found', async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      const result = await service.query(companyId, '¿Qué es una vacuna?');

      expect(result).toBeDefined();
    });

    it('should include conversation history', async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [] });
      const history = [
        { role: 'user', content: 'Hola' },
        { role: 'assistant', content: 'Hola, ¿en qué puedo ayudarte?' },
      ];

      await service.query(companyId, '¿Cuántas mascotas?', history);

      const createCall = (service as any).groq.chat.completions.create.mock.calls[0][0];
      expect(createCall.messages.length).toBeGreaterThan(2);
    });
  });

  describe('queryStream', () => {
    it('should yield chunks of text', async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [] });
      (service as any).groq.chat.completions.create.mockResolvedValue({
        choices: [{
          delta: { content: 'chunk' },
          finish_reason: null,
        }],
        [Symbol.asyncIterator]() {
          let i = 0;
          return {
            next: () => {
              if (i === 0) {
                i++;
                return Promise.resolve({ value: { choices: [{ delta: { content: 'Hola' }, finish_reason: null }] }, done: false });
              }
              return Promise.resolve({ done: true });
            },
          };
        },
      });

      const chunks: string[] = [];
      for await (const chunk of service.queryStream(companyId, 'test')) {
        chunks.push(chunk);
      }

      expect(chunks.length).toBeGreaterThan(0);
    });
  });
});
