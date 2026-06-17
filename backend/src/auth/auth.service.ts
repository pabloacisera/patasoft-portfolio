import { Injectable, UnauthorizedException, ConflictException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto, LoginDto } from './dto/auth.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existingUser) {
      throw new ConflictException('El email ya está registrado');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        name: dto.name,
        role: 'USER',
      },
    });

    const tokens = await this.generateTokens(user.id, user.email, user.companyId);

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
      ...tokens,
    };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const isValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isValid) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const tokens = await this.generateTokens(user.id, user.email, user.companyId);

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
      ...tokens,
    };
  }

  async refreshToken(refreshToken: string) {
    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET,
      });

      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
      });

      if (!user) {
        throw new UnauthorizedException('Usuario no encontrado');
      }

      const dbToken = await this.prisma.refreshToken.findFirst({
        where: { token: refreshToken, userId: user.id },
      });

      if (!dbToken || dbToken.expiresAt < new Date()) {
        throw new UnauthorizedException('Token inválido o expirado');
      }

      await this.prisma.refreshToken.delete({ where: { id: dbToken.id } });

      const tokens = await this.generateTokens(user.id, user.email, user.companyId);

      return {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
        ...tokens,
      };
    } catch {
      throw new UnauthorizedException('Token inválido');
    }
  }

  async validateUser(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { company: true },
    });

    if (!user || !user.isActive) {
      return null;
    }

    return user;
  }

  async getMe(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        company: {
          include: {
            subscription: true,
            config: true,
          },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException('Usuario no encontrado');
    }

    const { passwordHash, ...result } = user;
    return result;
  }

  async registerOAuthUser(profile: any) {
    const user = await this.prisma.user.findUnique({
      where: { googleId: profile.id },
    });

    if (user) {
      const tokens = await this.generateTokens(user.id, user.email, user.companyId);
      return {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
        ...tokens,
      };
    }

    return { message: 'Usuario creado via Google OAuth', profile };
  }

  async googleCallback(user: any) {
    if (!user) {
      throw new UnauthorizedException('No se recibió usuario desde Google');
    }
    const tokens = await this.generateTokens(user.id, user.email, user.companyId);
    return tokens;
  }

  private async generateTokens(userId: number, email: string, companyId?: number | null) {
    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(
        { sub: userId, email, companyId: companyId || null },
        { secret: process.env.JWT_SECRET, expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
      ),
      this.jwtService.signAsync(
        { sub: userId, email, companyId: companyId || null },
        { secret: process.env.JWT_REFRESH_SECRET, expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d' }
      ),
    ]);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    await this.prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId,
        expiresAt,
      },
    });

    return { accessToken, refreshToken };
  }
}