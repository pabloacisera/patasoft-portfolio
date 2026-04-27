import { Injectable, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector, private jwtService: JwtService) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>('isPublic', [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const result = await super.canActivate(context) as boolean;
    if (!result) return false;

    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const route = request.route?.path || '';

    if (!user) return false;

    // SUPER_ADMIN puede operar sin companyId
    if (user.role === 'SUPER_ADMIN') {
      return true;
    }

    // Rutas que permiten crear empresa sin companyId
    const routesWithoutCompanyRequired = [
      '/api/v1/companies', // POST crear empresa
    ];

    if (!user.companyId) {
      // Rutas permitidas sin empresa (onboarding y consulta de empresa propia)
      const requestPath = request.path || '';
      const exemptPaths = ['/api/v1/companies/me', '/api/v1/companies'];
      if (exemptPaths.some(p => requestPath.startsWith(p))) {
        return true;
      }

      // Permitir crear empresa si no tiene y está en ruta correcta
      if (route === '/api/v1/companies' && request.method === 'POST') {
        return true;
      }
      
      // Permitir onboarding path del frontend
      if (route === '/api/v1/users/onboarding') {
        return true;
      }
      
      throw new ForbiddenException(
        'ONBOARDING_REQUIRED:Tu cuenta no tiene una empresa asociada. Completa el onboarding primero.'
      );
    }

    return true;
  }
}