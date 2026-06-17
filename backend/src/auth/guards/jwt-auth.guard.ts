import { Injectable, ExecutionContext, ForbiddenException, Logger } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  private readonly logger = new Logger(JwtAuthGuard.name);

  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
    private redis: RedisService,
  ) {
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

    // Rutas permitidas con suscripción vencida (renovar, consultar estado, exportar datos)
    const subscriptionExemptRoutes = [
      '/api/v1/companies/me',
      '/api/v1/subscriptions/status',
      '/api/v1/subscriptions/checkout',
      '/api/v1/auth/me',
      '/api/v1/data/export-all',
    ];
    if (subscriptionExemptRoutes.some(p => request.path.startsWith(p))) {
      return true;
    }

    // Check de suscripción expirada en cada request (con cache Redis)
    try {
      const cacheKey = `sub_status:${user.companyId}`;
      const cachedSubscription = await this.redis.get(cacheKey);
      let subscriptionData: any;
      
      if (!cachedSubscription) {
        const subscription = await this.prisma.subscription.findUnique({
          where: { companyId: user.companyId },
        });
        
        if (subscription) {
          await this.redis.set(cacheKey, JSON.stringify(subscription), 300);
          subscriptionData = subscription;
        }
      } else {
        subscriptionData = JSON.parse(cachedSubscription);
      }

      if (subscriptionData) {
        const now = new Date();
        const isTrialExpired = subscriptionData.status === 'TRIAL' && subscriptionData.trialEndsAt && new Date(subscriptionData.trialEndsAt) < now;
        const isSubExpired = subscriptionData.status === 'ACTIVE' && subscriptionData.expiresAt && new Date(subscriptionData.expiresAt) < now;
        
        if (isTrialExpired || isSubExpired || subscriptionData.status === 'BLOCKED') {
          throw new ForbiddenException('SUBSCRIPTION_EXPIRED:Tu suscripción ha expirado. Por favor renová en Configuración / Suscripción.');
        }
      }
    } catch (e) {
      if (e instanceof ForbiddenException && e.message.includes('SUBSCRIPTION_EXPIRED')) {
        throw e;
      }
      if (e instanceof ForbiddenException) {
        throw e;
      }
      this.logger.warn(`Subscription check falló, permitiendo request: ${e.message}`);
    }

    return true;
  }
}