import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

@Controller('health')
export class HealthController {
  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
  ) {}

  @Get()
  async check() {
    const checks = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      services: {
        postgresql: 'unknown',
        redis: 'unknown',
      },
    };

    // Check PostgreSQL
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      checks.services.postgresql = 'ok';
    } catch {
      checks.services.postgresql = 'error';
      checks.status = 'degraded';
    }

    // Check Redis
    try {
      const redisOk = await this.redis.ping();
      checks.services.redis = redisOk ? 'ok' : 'error';
      if (!redisOk) checks.status = 'degraded';
    } catch {
      checks.services.redis = 'error';
      checks.status = 'degraded';
    }

    return checks;
  }
}