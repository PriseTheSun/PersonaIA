import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { CsrfGuard } from './csrf.guard';

describe('CsrfGuard', () => {
  const reflector = { getAllAndOverride: jest.fn().mockReturnValue(false) };
  const guard = new CsrfGuard(reflector as never);
  const context = (cookie?: string, header?: string) => ({
    getHandler: () => null,
    getClass: () => null,
    switchToHttp: () => ({ getRequest: () => ({ method: 'PATCH', cookies: { 'XSRF-TOKEN': cookie }, get: () => header }) })
  }) as unknown as ExecutionContext;

  it('rejects a mutation without a matching double-submit token', () => {
    expect(() => guard.canActivate(context('trusted-token', 'attacker-token'))).toThrow(ForbiddenException);
  });

  it('accepts a matching token', () => {
    expect(guard.canActivate(context('trusted-token', 'trusted-token'))).toBe(true);
  });
});
