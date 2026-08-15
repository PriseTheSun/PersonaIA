import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { RolesGuard } from './roles.guard';

describe('RolesGuard deny-by-default policy', () => {
  const context = (role = 'CLIENT_ADMIN') => ({
    getHandler: () => null,
    getClass: () => null,
    switchToHttp: () => ({ getRequest: () => ({ user: { role } }) })
  }) as unknown as ExecutionContext;

  it('allows routes explicitly marked public', () => {
    const reflector = { getAllAndOverride: jest.fn((key: string) => key === IS_PUBLIC_KEY ? true : undefined) };
    expect(new RolesGuard(reflector as never).canActivate(context())).toBe(true);
  });

  it('denies an authenticated route with no explicit role policy', () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(undefined) };
    expect(() => new RolesGuard(reflector as never).canActivate(context())).toThrow(ForbiddenException);
  });

  it('allows only a role listed by the endpoint policy', () => {
    const reflector = { getAllAndOverride: jest.fn((key: string) => key === ROLES_KEY ? ['SUPER_ADMIN'] : false) };
    const guard = new RolesGuard(reflector as never);
    expect(guard.canActivate(context('SUPER_ADMIN'))).toBe(true);
    expect(() => guard.canActivate(context('CLIENT_ADMIN'))).toThrow(ForbiddenException);
  });
});
