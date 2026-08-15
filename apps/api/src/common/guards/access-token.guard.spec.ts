import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AccessTokenGuard } from './access-token.guard';

describe('AccessTokenGuard JWT hardening', () => {
  it('rejects a token failing strict verification and never queries the user', async () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(false) };
    const jwt = { verifyAsync: jest.fn().mockRejectedValue(new Error('invalid algorithm')) };
    const config = { getOrThrow: jest.fn((key: string) => ({
      JWT_ACCESS_SECRET: 'long-test-secret-long-test-secret', JWT_ISSUER: 'personaia-api', JWT_AUDIENCE: 'personaia-web'
    })[key]) };
    const prisma = { user: { findFirst: jest.fn() } };
    const guard = new AccessTokenGuard(reflector as never, jwt as never, config as never, prisma as never);
    const context = {
      getHandler: () => null, getClass: () => null,
      switchToHttp: () => ({ getRequest: () => ({ headers: { authorization: 'Bearer malicious-token' } }) })
    } as unknown as ExecutionContext;

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(jwt.verifyAsync).toHaveBeenCalledWith('malicious-token', expect.objectContaining({ algorithms: ['HS256'], issuer: 'personaia-api', audience: 'personaia-web' }));
    expect(prisma.user.findFirst).not.toHaveBeenCalled();
  });
});
