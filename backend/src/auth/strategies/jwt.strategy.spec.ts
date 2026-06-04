import { describe, it, expect, vi } from 'vitest';
import { JwtStrategy } from './jwt.strategy';
import { ConfigService } from '@nestjs/config';

describe('JwtStrategy', () => {
  it('should throw error if JWT_SECRET is not configured', () => {
    const mockConfigService = {
      get: vi.fn().mockReturnValue(undefined),
    } as any;

    const mockAuthService = {} as any;

    expect(() => {
      new JwtStrategy(mockConfigService, mockAuthService);
    }).toThrow('JWT_SECRET must be configured with a secure value');
  });

  it('should throw error if JWT_SECRET is placeholder', () => {
    const mockConfigService = {
      get: vi.fn().mockReturnValue('CAMBIAR_POR_SECRET_SEGURO_openssl_rand_base64_64'),
    } as any;

    const mockAuthService = {} as any;

    expect(() => {
      new JwtStrategy(mockConfigService, mockAuthService);
    }).toThrow('JWT_SECRET must be configured with a secure value');
  });

  it('should not throw if JWT_SECRET is valid', () => {
    const mockConfigService = {
      get: vi.fn().mockReturnValue('valid-secret-for-testing-purposes-only'),
    } as any;

    const mockAuthService = {
      validateUser: vi.fn(),
    } as any;

    expect(() => {
      new JwtStrategy(mockConfigService, mockAuthService);
    }).not.toThrow();
  });
});
