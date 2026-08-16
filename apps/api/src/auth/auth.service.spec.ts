import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import * as argon2 from 'argon2';
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
          user: { id: '30000000-0000-4000-8000-000000000003', tokenVersion: 0, status: 'ACTIVE', role: 'SUPER_ADMIN', clientMemberships: [] }
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
    const service = new AuthService(prisma as never, jwt as never, config as never, {} as never);

    await expect(service.refresh('replayed-token', {})).rejects.toBeInstanceOf(UnauthorizedException);
    expect(updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ familyId: '20000000-0000-4000-8000-000000000002' }) }));
    expect(incrementVersion).toHaveBeenCalledWith(expect.objectContaining({ data: { tokenVersion: { increment: 1 } } }));
  });
});

describe('AuthService account approval', () => {
  it('creates self-registrations as pending project users and audits the request', async () => {
    const tx = {
      user: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: '30000000-0000-4000-8000-000000000003' }),
      },
      clientMembership: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({}),
      },
      auditLog: { create: jest.fn().mockResolvedValue({}) }
    };
    const prisma = {
      tenant: { findFirst: jest.fn().mockResolvedValue({ id: '10000000-0000-4000-8000-000000000001', name: 'Cliente Teste' }) },
      user: { findUnique: jest.fn().mockResolvedValue(null) },
      $transaction: jest.fn(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx))
    };
    const notifications = { dispatchAccessRequest: jest.fn().mockResolvedValue(undefined) };
    const service = new AuthService(prisma as never, {} as never, {} as never, notifications as never);

    await expect(service.register({
      name: 'Pessoa Teste', email: 'Pessoa@Teste.dev', password: 'UmaSenha#MuitoForte2026', tenantSlug: 'cliente-teste'
    })).resolves.toEqual({ status: 'PENDING' });
    expect(tx.user.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ email: 'pessoa@teste.dev', role: 'PROJECT_USER', status: 'PENDING_APPROVAL' })
    }));
    expect(tx.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: 'USER_REGISTERED' }) }));
    expect(notifications.dispatchAccessRequest).toHaveBeenCalledWith(tx, {
      userId: '30000000-0000-4000-8000-000000000003',
      userName: 'Pessoa Teste',
      userEmail: 'pessoa@teste.dev',
      tenantId: '10000000-0000-4000-8000-000000000001',
      tenantName: 'Cliente Teste'
    });
  });

  it('refuses login with the correct password while approval is pending', async () => {
    const passwordHash = await argon2.hash('UmaSenha#MuitoForte2026', { type: argon2.argon2id });
    const prisma = {
      user: { findUnique: jest.fn().mockResolvedValue({
        id: '30000000-0000-4000-8000-000000000003', tenantId: '10000000-0000-4000-8000-000000000001',
        name: 'Pessoa Teste', email: 'pessoa@teste.dev', passwordHash, role: 'PROJECT_USER', status: 'PENDING', tokenVersion: 0,
        clientMemberships: []
      }) }
    };
    const service = new AuthService(prisma as never, {} as never, {} as never, {} as never);

    try {
      await service.login({ email: 'pessoa@teste.dev', password: 'UmaSenha#MuitoForte2026', rememberMe: false }, {});
      throw new Error('O login pendente deveria ter sido recusado.');
    } catch (error) {
      expect(error).toBeInstanceOf(ForbiddenException);
      expect((error as ForbiddenException).getResponse()).toEqual(expect.objectContaining({ code: 'ACCOUNT_PENDING' }));
    }
  });
});

describe('AuthService 120-minute absolute session lifetime', () => {
  const startedAt = new Date('2026-08-15T20:00:00.000Z');
  const expiresAt = new Date('2026-08-15T22:00:00.000Z');
  const user = {
    id: '30000000-0000-4000-8000-000000000003', tenantId: null, name: 'Admin', email: 'admin@personaia.test',
    role: 'SUPER_ADMIN', status: 'ACTIVE', tokenVersion: 0, clientMemberships: [],
  };
  const configValues: Record<string, string | number> = {
    JWT_ACCESS_SECRET: 'access-secret-that-is-long-enough-for-tests',
    JWT_REFRESH_SECRET: 'refresh-secret-that-is-long-enough-for-tests',
    JWT_ISSUER: 'personaia-api',
    JWT_AUDIENCE: 'personaia-web',
    JWT_ACCESS_TTL: '15m',
    SESSION_TTL_MINUTES: 120,
  };

  beforeEach(() => jest.useFakeTimers().setSystemTime(startedAt));
  afterEach(() => jest.useRealTimers());

  it('creates a session that expires exactly 120 minutes after login', async () => {
    const passwordHash = await argon2.hash('UmaSenha#MuitoForte2026', { type: argon2.argon2id });
    const refreshSessionCreate = jest.fn().mockResolvedValue({});
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({ ...user, passwordHash }),
        update: jest.fn().mockResolvedValue(user),
      },
      refreshSession: { create: refreshSessionCreate },
    };
    const jwt = { signAsync: jest.fn().mockResolvedValueOnce('refresh-token').mockResolvedValueOnce('access-token') };
    const config = { getOrThrow: jest.fn((key: string) => configValues[key]) };
    const service = new AuthService(prisma as never, jwt as never, config as never, {} as never);

    const result = await service.login({ email: user.email, password: 'UmaSenha#MuitoForte2026', rememberMe: true }, {});

    expect(result.sessionExpiresAt).toBe(expiresAt.toISOString());
    expect(refreshSessionCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ expiresAt }) }));
    expect(jwt.signAsync.mock.calls[0]?.[1]).toEqual(expect.objectContaining({ expiresIn: 7_200 }));
    expect(jwt.signAsync.mock.calls[1]?.[1]).toEqual(expect.objectContaining({ expiresIn: 900 }));
  });

  it('preserves the original deadline when the refresh token rotates', async () => {
    jest.setSystemTime(new Date('2026-08-15T20:30:00.000Z'));
    const rotatedSessionCreate = jest.fn().mockResolvedValue({});
    const tx = {
      refreshSession: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        create: rotatedSessionCreate,
      },
    };
    const prisma = {
      refreshSession: { findUnique: jest.fn().mockResolvedValue({
        id: '10000000-0000-4000-8000-000000000001', familyId: '20000000-0000-4000-8000-000000000002', userId: user.id,
        revokedAt: null, createdAt: startedAt, expiresAt, user,
      }) },
      $transaction: jest.fn(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx)),
    };
    const jwt = {
      verifyAsync: jest.fn().mockResolvedValue({
        sub: user.id, sid: '10000000-0000-4000-8000-000000000001', fid: '20000000-0000-4000-8000-000000000002', type: 'refresh', ver: 0, rem: true,
      }),
      signAsync: jest.fn().mockResolvedValueOnce('rotated-refresh-token').mockResolvedValueOnce('rotated-access-token'),
    };
    const config = { getOrThrow: jest.fn((key: string) => configValues[key]) };
    const service = new AuthService(prisma as never, jwt as never, config as never, {} as never);

    const result = await service.refresh('refresh-token', {});

    expect(result.sessionExpiresAt).toBe(expiresAt.toISOString());
    expect(rotatedSessionCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ expiresAt }) }));
    expect(jwt.signAsync.mock.calls[0]?.[1]).toEqual(expect.objectContaining({ expiresIn: 5_400 }));
    expect(jwt.signAsync.mock.calls[1]?.[1]).toEqual(expect.objectContaining({ expiresIn: 900 }));
  });
});
