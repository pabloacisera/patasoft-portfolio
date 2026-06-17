import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AiProxyService } from './ai-proxy.service';
import { InternalServerErrorException, NotFoundException } from '@nestjs/common';

describe('AiProxyService', () => {
  let service: AiProxyService;
  let mockConfig: any;
  let mockPrisma: any;
  let mockLocalRag: any;

  beforeEach(() => {
    mockConfig = {
      get: vi.fn().mockImplementation((key: string) => {
        const values: Record<string, any> = {
          SCALE_MODE: 'PRO',
          AI_SERVICE_URL: 'http://ai-service.local',
          AI_SERVICE_API_KEY: 'proxy-key',
        };
        return values[key];
      }),
    };
    mockPrisma = {
      companyConfig: {
        findUnique: vi.fn().mockResolvedValue({
          defaultAIModel: 'gpt-4o-mini',
          company: {
            name: 'PataSoft',
            address: 'Calle 123',
            animalSpecialties: ['DOG'],
          },
        }),
      },
      company: {
        findUnique: vi.fn(),
      },
    };
    mockLocalRag = {
      query: vi.fn(),
      queryStream: vi.fn(),
    };
    service = new AiProxyService(mockConfig, mockPrisma, mockLocalRag);
  });

  it('streams chat requests to the AI service in PRO mode', async () => {
    const response = new Response(new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('data: {"content":"Hola"}\n\n'));
        controller.close();
      },
    }), {
      headers: { 'content-type': 'text/event-stream' },
    });

    const fetchSpy = vi.spyOn(globalThis as any, 'fetch').mockResolvedValue(response as any);

    const result = await service.chatStream('company-1', {
      message: 'Hola',
      history: [{ role: 'user', content: 'Anterior' }],
      sessionId: 'session-1',
    } as any);

    expect(result).toBe(response);
    expect(fetchSpy).toHaveBeenCalledWith(
      'http://ai-service.local/api/v1/chat/stream',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const body = JSON.parse((fetchSpy.mock.calls[0][1] as RequestInit).body as string);
    expect(body.company_id).toBe('company-1');
    expect(body.session_id).toBe('session-1');
    expect(body.company_name).toBe('PataSoft');
    expect(body.specialties).toEqual(['DOG']);
  });

  it('throws if chatStream is called outside PRO mode', async () => {
    mockConfig.get.mockImplementation((key: string) => {
      if (key === 'SCALE_MODE') return 'local';
      return undefined;
    });
    service = new AiProxyService(mockConfig, mockPrisma, mockLocalRag);

    await expect(service.chatStream('company-1', { message: 'Hola' } as any))
      .rejects.toThrow(InternalServerErrorException);
  });

  it('throws NotFoundException when company config is missing', async () => {
    mockPrisma.companyConfig.findUnique.mockResolvedValueOnce(null);

    await expect(service.chat('company-1', { message: 'Hola' } as any))
      .rejects.toThrow(NotFoundException);
  });
});
