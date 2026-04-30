import { Controller, Post, Body, Get, UseGuards, Req, Res } from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { RegisterDto, LoginDto, RefreshTokenDto, GuestSessionDto } from './dto/auth.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';

@ApiTags('auth')
@Controller('api/v1/auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('register')
  @ApiOperation({ summary: 'Registro de usuario nuevo' })
  @ApiResponse({ status: 201, description: 'Usuario registrado exitosamente' })
  @ApiResponse({ status: 409, description: 'Email ya registrado' })
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  @ApiOperation({ summary: 'Login con email y password' })
  @ApiResponse({ status: 200, description: 'Login exitoso' })
  @ApiResponse({ status: 401, description: 'Credenciales inválidas' })
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('refresh')
  @ApiOperation({ summary: 'Refresh del access token' })
  @ApiResponse({ status: 200, description: 'Token refrescado' })
  @ApiResponse({ status: 401, description: 'Token inválido' })
  async refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refreshToken(dto.refreshToken);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Obtener perfil del usuario actual' })
  @ApiResponse({ status: 200, description: 'Perfil obtenido' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async getMe(@CurrentUser() user: any) {
    return this.authService.getMe(user.id);
  }

  @Get('google')
  @UseGuards(AuthGuard('google'))
  @ApiOperation({ summary: 'Login con Google OAuth' })
  async googleAuth() {}

  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  @ApiOperation({ summary: 'Callback de Google OAuth' })
  async googleAuthCallback(@Req() req: any, @Res() res: Response) {
    console.log('[Google Callback] req.user recibido:', req.user ? `id=${req.user.id}` : 'UNDEFINED');
    
    if (!req.user) {
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      console.error('[Google Callback] ERROR: req.user es undefined, redirigiendo a login');
      return res.redirect(`${frontendUrl}/login?error=oauth_failed`);
    }
    
    const tokens = await this.authService.googleCallback(req.user);
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    
    // Verificar si el usuario tiene empresa asociada
if (!req.user.companyId) {
      console.log('[Google Callback] Usuario sin empresa, redirigiendo a onboarding');
      return res.redirect(
        `${frontendUrl}/onboarding?token=${encodeURIComponent(tokens.accessToken)}&refresh=${encodeURIComponent(tokens.refreshToken)}&needsCompany=true`
      );
    }

    console.log('[Google Callback] Redirigiendo a:', `${frontendUrl}/auth/callback?token=${encodeURIComponent(tokens.accessToken)}&refresh=${encodeURIComponent(tokens.refreshToken)}`);

    return res.redirect(
      `${frontendUrl}/auth/callback?token=${encodeURIComponent(tokens.accessToken)}&refresh=${encodeURIComponent(tokens.refreshToken)}`
    );
  }

  @Post('guest')
  @ApiOperation({ summary: 'Crear sesión de invitado' })
  @ApiResponse({ status: 201, description: 'Sesión de invitado creada' })
  async createGuestSession(@Body() dto: GuestSessionDto) {
    const sessionId = dto.deviceId || this.generateSessionId();
    
    return {
      sessionId,
      expiresIn: 259200,
      message: 'Sesión de invitado creada. Datos se almacenan localmente.',
    };
  }

  private generateSessionId(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 32; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }
}