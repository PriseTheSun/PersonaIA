import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';

describe('AuthService refresh reuse detection', () => {
  it('revokes the token family and bumps tokenVersion when a revoked refresh is replayed', async () => {
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const incrementVersion = jest.fn().mockResolvedValue({});
    const prisma = {
      refreshSession: {
        findUnique: jest.fn().mockResolvedValue({
          id: '10000000-0000-4000-8000-000000000001', familyId: '20000000-0000-4000-8000-000000000002', userId: '30000000-0000-4000-8000-000000000003',
          revokedAt: new Date(), expiresAt: new Date(Date.now() + 60_000),
          user: { id: '30000000-0000-4000-8000-000000000003', tokenVersion: 0, status: 'ACTIVE', tenant: null }
        }),
        updateMany
      },
      user: { update: incrementVersion },
      $transaction: jest.fn(async (operations: Promise<unknown>[]) => Promise.all(operations))
    };
    const jwt = { verifyAsync: jest.fn().mockResolvedValue({
      sub: '30000000-0000-4000-8000-000000000003', sid: '10000000-0000-4000-8000-000000000001', fid: '20000000-0000-4000-8000-000000000002', type: 'refresh', ver: 0
    }) };
    const config = { getOrThrow: jest.fn((key: string) => key.includes('SECRET') ? 'a-secure-test-secret-that-is-long-enough' : 7) };
    const service = new AuthService(prisma as never, jwt as never, config as never);

    await expect(service.refresh('replayed-token', {})).rejects.toBeInstanceOf(UnauthorizedException);
    expect(updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ familyId: '20000000-0000-4000-8000-000000000002' }) }));
    expect(incrementVersion).toHaveBeenCalledWith(expect.objectContaining({ data: { tokenVersion: { increment: 1 } } }));
  });
});
