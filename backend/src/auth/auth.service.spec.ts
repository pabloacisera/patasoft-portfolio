import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('bcrypt', () => ({
  hash: vi.fn(),
  compare: vi.fn(),
}));

import * as bcrypt from 'bcrypt';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: PrismaService;
  let jwtService: JwtService;

  const mockPrisma = {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    refreshToken: {
      findFirst: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
  };

  const mockJwtService = {
    signAsync: vi.fn(),
    verify: vi.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: JwtService, useValue: mockJwtService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    prisma = module.get<PrismaService>(PrismaService);
    jwtService = module.get<JwtService>(JwtService);

    vi.clearAllMocks();
  });

  describe('register', () => {
    it('should register a new user successfully', async () => {
      const dto = { email: 'test@example.com', password: 'password123', name: 'Test User' };
      const hashedPassword = 'hashedPassword123';
      const user = { id: '1', email: dto.email, name: dto.name, role: 'USER', companyId: null };
      const tokens = { accessToken: 'access', refreshToken: 'refresh' };

      mockPrisma.user.findUnique.mockResolvedValue(null);
      vi.spyOn(bcrypt, 'hash').mockImplementation(() => Promise.resolve(hashedPassword as never));
      mockPrisma.user.create.mockResolvedValue(user);
      mockJwtService.signAsync.mockResolvedValueOnce('access').mockResolvedValueOnce('refresh');
      mockPrisma.refreshToken.create.mockResolvedValue({});

      const result = await service.register(dto);

      expect(result.user.email).toBe(dto.email);
      expect(result.accessToken).toBe('access');
      expect(result.refreshToken).toBe('refresh');
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({ where: { email: dto.email } });
      expect(mockPrisma.user.create).toHaveBeenCalledWith({
        data: {
          email: dto.email,
          passwordHash: hashedPassword,
          name: dto.name,
          role: 'USER',
        },
      });
    });

    it('should throw ConflictException if email already exists', async () => {
      const dto = { email: 'existing@example.com', password: 'password123', name: 'Test' };
      mockPrisma.user.findUnique.mockResolvedValue({ id: '1', email: dto.email });

      await expect(service.register(dto)).rejects.toThrow(ConflictException);
      await expect(service.register(dto)).rejects.toThrow('El email ya está registrado');
    });
  });

  describe('login', () => {
    it('should login successfully with valid credentials', async () => {
      const dto = { email: 'test@example.com', password: 'password123' };
      const user = { id: '1', email: dto.email, name: 'Test', role: 'USER', companyId: null, passwordHash: 'hashed' };

      mockPrisma.user.findUnique.mockResolvedValue(user);
      vi.spyOn(bcrypt, 'compare').mockImplementation(() => Promise.resolve(true as never));
      mockJwtService.signAsync.mockResolvedValueOnce('access').mockResolvedValueOnce('refresh');
      mockPrisma.refreshToken.create.mockResolvedValue({});

      const result = await service.login(dto);

      expect(result.user.email).toBe(dto.email);
      expect(result.accessToken).toBe('access');
      expect(result.refreshToken).toBe('refresh');
      expect(bcrypt.compare).toHaveBeenCalledWith(dto.password, user.passwordHash);
    });

    it('should throw UnauthorizedException if user not found', async () => {
      const dto = { email: 'nonexistent@example.com', password: 'password123' };
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(service.login(dto)).rejects.toThrow(UnauthorizedException);
      await expect(service.login(dto)).rejects.toThrow('Credenciales inválidas');
    });

    it('should throw UnauthorizedException if password is invalid', async () => {
      const dto = { email: 'test@example.com', password: 'wrongpassword' };
      const user = { id: '1', email: dto.email, passwordHash: 'hashed' };

      mockPrisma.user.findUnique.mockResolvedValue(user);
      vi.spyOn(bcrypt, 'compare').mockImplementation(() => Promise.resolve(false as never));

      await expect(service.login(dto)).rejects.toThrow(UnauthorizedException);
      await expect(service.login(dto)).rejects.toThrow('Credenciales inválidas');
    });

    it('should throw UnauthorizedException if user has no passwordHash (OAuth user)', async () => {
      const dto = { email: 'oauth@example.com', password: 'password123' };
      const user = { id: '1', email: dto.email, passwordHash: null };

      mockPrisma.user.findUnique.mockResolvedValue(user);

      await expect(service.login(dto)).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('refreshToken', () => {
    it('should refresh tokens successfully', async () => {
      const refreshToken = 'valid-refresh-token';
      const payload = { sub: '1', email: 'test@example.com' };
      const user = { id: '1', email: 'test@example.com', name: 'Test', role: 'USER', companyId: null };
      const dbToken = { id: 'token-1', token: refreshToken, userId: '1', expiresAt: new Date(Date.now() + 86400000) };

      mockJwtService.verify.mockReturnValue(payload);
      mockPrisma.user.findUnique.mockResolvedValue(user);
      mockPrisma.refreshToken.findFirst.mockResolvedValue(dbToken);
      mockPrisma.refreshToken.delete.mockResolvedValue({});
      mockJwtService.signAsync.mockResolvedValueOnce('new-access').mockResolvedValueOnce('new-refresh');
      mockPrisma.refreshToken.create.mockResolvedValue({});

      const result = await service.refreshToken(refreshToken);

      expect(result.user.email).toBe(user.email);
      expect(result.accessToken).toBe('new-access');
      expect(result.refreshToken).toBe('new-refresh');
      expect(mockJwtService.verify).toHaveBeenCalledWith(refreshToken, { secret: process.env.JWT_REFRESH_SECRET });
      expect(mockPrisma.refreshToken.delete).toHaveBeenCalledWith({ where: { id: dbToken.id } });
    });

    it('should throw UnauthorizedException if refresh token is invalid', async () => {
      const refreshToken = 'invalid-token';
      mockJwtService.verify.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      await expect(service.refreshToken(refreshToken)).rejects.toThrow(UnauthorizedException);
      await expect(service.refreshToken(refreshToken)).rejects.toThrow('Token inválido');
    });

    it('should throw UnauthorizedException if user not found', async () => {
      const refreshToken = 'valid-token';
      const payload = { sub: '999', email: 'test@example.com' };

      mockJwtService.verify.mockReturnValue(payload);
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(service.refreshToken(refreshToken)).rejects.toThrow(UnauthorizedException);
      await expect(service.refreshToken(refreshToken)).rejects.toThrow('Token inválido');
    });

    it('should throw UnauthorizedException if refresh token not found in DB', async () => {
      const refreshToken = 'not-in-db-token';
      const payload = { sub: '1', email: 'test@example.com' };
      const user = { id: '1', email: 'test@example.com' };

      mockJwtService.verify.mockReturnValue(payload);
      mockPrisma.user.findUnique.mockResolvedValue(user);
      mockPrisma.refreshToken.findFirst.mockResolvedValue(null);

      await expect(service.refreshToken(refreshToken)).rejects.toThrow(UnauthorizedException);
      await expect(service.refreshToken(refreshToken)).rejects.toThrow('Token inválido');
    });

    it('should throw UnauthorizedException if refresh token is expired', async () => {
      const refreshToken = 'expired-token';
      const payload = { sub: '1', email: 'test@example.com' };
      const user = { id: '1', email: 'test@example.com' };
      const dbToken = { id: 'token-1', token: refreshToken, userId: '1', expiresAt: new Date(Date.now() - 86400000) };

      mockJwtService.verify.mockReturnValue(payload);
      mockPrisma.user.findUnique.mockResolvedValue(user);
      mockPrisma.refreshToken.findFirst.mockResolvedValue(dbToken);

      await expect(service.refreshToken(refreshToken)).rejects.toThrow(UnauthorizedException);
      await expect(service.refreshToken(refreshToken)).rejects.toThrow('Token inválido');
    });
  });

  describe('validateUser', () => {
    it('should return user if active', async () => {
      const userId = '1';
      const user = { id: userId, email: 'test@example.com', isActive: true, company: {} };

      mockPrisma.user.findUnique.mockResolvedValue(user);

      const result = await service.validateUser(userId);

      expect(result).toEqual(user);
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: userId },
        include: { company: true },
      });
    });

    it('should return null if user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const result = await service.validateUser('999');

      expect(result).toBeNull();
    });

    it('should return null if user is inactive', async () => {
      const userId = '1';
      const user = { id: userId, email: 'test@example.com', isActive: false };

      mockPrisma.user.findUnique.mockResolvedValue(user);

      const result = await service.validateUser(userId);

      expect(result).toBeNull();
    });
  });

  describe('getMe', () => {
    it('should return user without passwordHash', async () => {
      const userId = '1';
      const user = {
        id: userId,
        email: 'test@example.com',
        name: 'Test',
        passwordHash: 'hashed',
        company: { id: 'c1', subscription: {}, config: {} },
      };

      mockPrisma.user.findUnique.mockResolvedValue(user);

      const result = await service.getMe(userId);

      expect(result.id).toBe(userId);
      expect(result.passwordHash).toBeUndefined();
      expect(result.company).toBeDefined();
    });

    it('should throw UnauthorizedException if user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(service.getMe('999')).rejects.toThrow(UnauthorizedException);
      await expect(service.getMe('999')).rejects.toThrow('Usuario no encontrado');
    });
  });

  describe('registerOAuthUser', () => {
    it('should return tokens for existing OAuth user', async () => {
      const profile = { id: 'google-123', email: 'oauth@example.com' };
      const user = { id: '1', email: profile.email, name: 'OAuth User', role: 'USER', companyId: null, googleId: profile.id };

      mockPrisma.user.findUnique.mockResolvedValue(user);
      mockJwtService.signAsync.mockResolvedValueOnce('access').mockResolvedValueOnce('refresh');
      mockPrisma.refreshToken.create.mockResolvedValue({});

      const result = await service.registerOAuthUser(profile);

      expect(result.user.email).toBe(profile.email);
      expect(result.accessToken).toBe('access');
      expect(result.refreshToken).toBe('refresh');
    });

    it('should return message for new OAuth user', async () => {
      const profile = { id: 'google-456', email: 'new@example.com' };

      mockPrisma.user.findUnique.mockResolvedValue(null);

      const result = await service.registerOAuthUser(profile);

      expect(result.message).toBe('Usuario creado via Google OAuth');
      expect(result.profile).toEqual(profile);
    });
  });

  describe('googleCallback', () => {
    it('should return tokens for valid user', async () => {
      const user = { id: '1', email: 'test@example.com', companyId: null };

      mockJwtService.signAsync.mockResolvedValueOnce('access').mockResolvedValueOnce('refresh');
      mockPrisma.refreshToken.create.mockResolvedValue({});

      const result = await service.googleCallback(user);

      expect(result.accessToken).toBe('access');
      expect(result.refreshToken).toBe('refresh');
    });

    it('should throw UnauthorizedException if user is null', async () => {
      await expect(service.googleCallback(null)).rejects.toThrow(UnauthorizedException);
      await expect(service.googleCallback(null)).rejects.toThrow('No se recibió usuario desde Google');
    });
  });
});
