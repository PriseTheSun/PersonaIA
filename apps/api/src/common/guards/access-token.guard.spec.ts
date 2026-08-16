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

  it('rejects an otherwise valid access token after the absolute session deadline', async () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(false) };
    const jwt = { verifyAsync: jest.fn().mockResolvedValue({
      sub: '30000000-0000-4000-8000-000000000003', type: 'access', ver: 0, sessionExpiresAt: '2020-01-01T00:00:00.000Z',
    }) };
    const config = { getOrThrow: jest.fn((key: string) => ({
      JWT_ACCESS_SECRET: 'long-test-secret-long-test-secret', JWT_ISSUER: 'personaia-api', JWT_AUDIENCE: 'personaia-web'
    })[key]) };
    const prisma = { user: { findFirst: jest.fn() } };
    const guard = new AccessTokenGuard(reflector as never, jwt as never, config as never, prisma as never);
    const context = {
      getHandler: () => null, getClass: () => null,
      switchToHttp: () => ({ getRequest: () => ({ headers: { authorization: 'Bearer expired-session-token' } }) })
    } as unknown as ExecutionContext;

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.user.findFirst).not.toHaveBeenCalled();
  });
});
