import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { TENANT_SCOPED_KEY } from '../decorators/tenant-scoped.decorator';
import { AuthenticatedRequest } from '../types/request';

@Injectable()
export class TenantScopeGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const scoped = this.reflector.getAllAndOverride<boolean>(TENANT_SCOPED_KEY, [context.getHandler(), context.getClass()]);
    if (!scoped) return true;
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!request.user?.tenantId || request.user.role === 'SUPER_ADMIN') {
      throw new ForbiddenException('Contexto de organização inválido.');
    }
    const routeTenantId = request.params?.tenantId;
    if (routeTenantId && routeTenantId !== request.user.tenantId) throw new ForbiddenException('Acesso entre organizações não permitido.');
    return true;
  }
}
