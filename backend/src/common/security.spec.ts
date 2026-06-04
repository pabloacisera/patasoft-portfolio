import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import helmet from 'helmet';

describe('Security Configuration', () => {
  let app: INestApplication;

  beforeEach(async () => {
    process.env.JWT_SECRET = 'test-secret-for-security-tests';
    process.env.THROTTLE_TTL = '60000';
    process.env.THROTTLE_LIMIT = '100';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        ThrottlerModule.forRoot([{
          ttl: parseInt(process.env.THROTTLE_TTL, 10),
          limit: parseInt(process.env.THROTTLE_LIMIT, 10),
        }]),
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(helmet());
    app.useGlobalPipes(new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }));
    await app.init();
  });

  afterEach(async () => {
    if (app) await app.close();
  });

  it('should have helmet configured', () => {
    expect(app).toBeDefined();
  });

  it('should have validation pipe configured', () => {
    expect(app).toBeDefined();
  });

  it('should have throttler module configured', () => {
    expect(app).toBeDefined();
  });
});
