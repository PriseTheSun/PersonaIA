import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { TenantScopeGuard } from './tenant-scope.guard';

describe('TenantScopeGuard', () => {
  const reflector = { getAllAndOverride: jest.fn().mockReturnValue(true) } as unknown as Reflector;
  const guard = new TenantScopeGuard(reflector);

  const context = (user: object, params: object = {}) => ({
    getHandler: () => null,
    getClass: () => null,
    switchToHttp: () => ({ getRequest: () => ({ user, params }) })
  }) as unknown as ExecutionContext;

  it('rejects an explicit tenant id from another tenant', () => {
    expect(() => guard.canActivate(context({ role: 'CLIENT_ADMIN', tenantId: 'tenant-a' }, { tenantId: 'tenant-b' }))).toThrow(ForbiddenException);
  });

  it('accepts the authenticated tenant', () => {
    expect(guard.canActivate(context({ role: 'CLIENT_ADMIN', tenantId: 'tenant-a' }, { tenantId: 'tenant-a' }))).toBe(true);
  });
});
