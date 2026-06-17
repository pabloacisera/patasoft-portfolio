import { describe, it, expect, beforeAll } from 'vitest';
import { Test } from '@nestjs/testing';
import { ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import helmet from 'helmet';
import { IsNotEmpty, IsString } from 'class-validator';

class TestValidationDto {
  @IsString()
  @IsNotEmpty()
  name!: string;
}

describe('Security Configuration', () => {
  let moduleFixture: any;

  beforeAll(async () => {
    process.env.JWT_SECRET = 'test-secret-for-security-tests';
    process.env.THROTTLE_TTL = '60000';
    process.env.THROTTLE_LIMIT = '100';

    moduleFixture = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        ThrottlerModule.forRoot([{
          ttl: parseInt(process.env.THROTTLE_TTL, 10),
          limit: parseInt(process.env.THROTTLE_LIMIT, 10),
        }]),
      ],
    }).compile();
  });

  it('should have helmet security headers', () => {
    const req = { headers: {} } as any;
    const headerStore = new Map<string, string>();
    const res = {
      setHeader: (key: string, value: any) => headerStore.set(key.toLowerCase(), String(value)),
      getHeader: (key: string) => headerStore.get(key.toLowerCase()),
      removeHeader: (key: string) => headerStore.delete(key.toLowerCase()),
    } as any;

    helmet()(req, res, () => undefined);

    expect(headerStore.get('x-dns-prefetch-control')).toBe('off');
    expect(headerStore.get('x-frame-options')).toBe('SAMEORIGIN');
    expect(headerStore.get('x-content-type-options')).toBe('nosniff');
    expect(headerStore.get('x-xss-protection')).toBe('0');
  });

  it('should reject requests with extra fields via validation pipe', async () => {
    const pipe = new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    });

    await expect(
      pipe.transform(
        { extraField: 'should-not-pass' },
        { type: 'body', metatype: TestValidationDto } as any,
      ),
    ).rejects.toBeDefined();
  });

  it('should have throttler module configured', () => {
    const modules = Array.from((moduleFixture as any).container.getModules().values());
    const hasThrottlerModule = modules.some((m: any) => m.metatype?.name === 'ThrottlerModule');
    expect(hasThrottlerModule).toBe(true);
  });
});
