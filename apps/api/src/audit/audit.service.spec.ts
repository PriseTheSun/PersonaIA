import { AuditService } from './audit.service';

const actor = {
  id: '11111111-1111-4111-8111-111111111111',
  tenantId: null,
  email: 'super@example.com',
  name: 'Super',
  role: 'SUPER_ADMIN' as const,
  tokenVersion: 0,
};

describe('AuditService', () => {
  it('returns a paginated global feed, redacts sensitive metadata and audits the read', async () => {
    const auditLog = {
      findMany: jest.fn()
        .mockResolvedValueOnce([{
          id: '22222222-2222-4222-8222-222222222222', action: 'USER_PASSWORD_CHANGED',
          targetType: 'User', targetId: actor.id, scopeType: 'PLATFORM', scopeId: null,
          metadata: { changed: true, refreshToken: 'must-not-leak', nested: { password: 'must-not-leak' } },
          createdAt: new Date('2026-08-20T12:00:00.000Z'),
          actor: { id: actor.id, name: actor.name, email: actor.email }, tenant: null,
        }])
        .mockResolvedValueOnce([{ action: 'USER_PASSWORD_CHANGED' }])
        .mockResolvedValueOnce([{ targetType: 'User' }]),
      count: jest.fn().mockResolvedValue(1),
      create: jest.fn().mockResolvedValue({}),
    };
    const prisma = {
      auditLog,
      tenant: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const service = new AuditService(prisma as never);

    const result = await service.list({
      page: 1, pageSize: 25, search: 'Super', from: '2026-08-01', to: '2026-08-20',
    }, actor);

    expect(result.pagination).toEqual({ page: 1, pageSize: 25, total: 1, totalPages: 1 });
    expect(result.items[0]?.metadata).toEqual({
      changed: true,
      refreshToken: '[REDACTED]',
      nested: { password: '[REDACTED]' },
    });
    expect(auditLog.findMany).toHaveBeenNthCalledWith(1, expect.objectContaining({
      skip: 0,
      take: 25,
      where: expect.objectContaining({
        createdAt: {
          gte: new Date('2026-08-01T00:00:00.000Z'),
          lte: new Date('2026-08-20T23:59:59.999Z'),
        },
        OR: expect.any(Array),
      }),
    }));
    expect(auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorId: actor.id,
        action: 'AUDIT_LOGS_VIEWED',
        metadata: expect.objectContaining({ returned: 1 }),
      }),
    });
    expect(JSON.stringify(result)).not.toContain('must-not-leak');
  });
});
