import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  let controller: HealthController;
  let mockPrisma: any;
  let mockRedis: any;

  beforeEach(() => {
    mockPrisma = {
      $queryRaw: vi.fn().mockResolvedValue([{ '?column?': 1 }]),
    };
    mockRedis = {
      ping: vi.fn().mockResolvedValue(true),
    };
    controller = new HealthController(mockPrisma, mockRedis);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should return ok when all services are healthy', async () => {
    const result = await controller.check();

    expect(result.status).toBe('ok');
    expect(result.services.postgresql).toBe('ok');
    expect(result.services.redis).toBe('ok');
    expect(result.timestamp).toBeDefined();
  });

  it('should return degraded when PostgreSQL is down', async () => {
    mockPrisma.$queryRaw.mockRejectedValue(new Error('Connection refused'));

    const result = await controller.check();

    expect(result.status).toBe('degraded');
    expect(result.services.postgresql).toBe('error');
    expect(result.services.redis).toBe('ok');
  });

  it('should return degraded when Redis is down', async () => {
    mockRedis.ping.mockResolvedValue(false);

    const result = await controller.check();

    expect(result.status).toBe('degraded');
    expect(result.services.postgresql).toBe('ok');
    expect(result.services.redis).toBe('error');
  });

  it('should return degraded when Redis throws', async () => {
    mockRedis.ping.mockRejectedValue(new Error('Connection refused'));

    const result = await controller.check();

    expect(result.status).toBe('degraded');
    expect(result.services.redis).toBe('error');
  });

  it('should return degraded when both services are down', async () => {
    mockPrisma.$queryRaw.mockRejectedValue(new Error('PG down'));
    mockRedis.ping.mockRejectedValue(new Error('Redis down'));

    const result = await controller.check();

    expect(result.status).toBe('degraded');
    expect(result.services.postgresql).toBe('error');
    expect(result.services.redis).toBe('error');
  });
});
