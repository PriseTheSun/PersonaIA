import { ForbiddenException } from '@nestjs/common';
import { DashboardService } from './dashboard.service';

describe('DashboardService scoped metrics', () => {
  const tenantId = '10000000-0000-4000-8000-000000000001';
  const actor = { id: '20000000-0000-4000-8000-000000000002', tenantId, email: 'admin@cliente.dev', name: 'Admin', role: 'CLIENT_ADMIN' as const, tokenVersion: 0 };

  beforeEach(() => jest.useFakeTimers().setSystemTime(new Date('2026-08-15T15:00:00.000Z')));
  afterEach(() => jest.useRealTimers());

  it('uses explicit tenant context and scoped membership counts', async () => {
    const prisma = {
      project: { findMany: jest.fn().mockResolvedValue([{ createdAt: new Date('2026-08-15T10:00:00Z') }]) },
      persona: { findMany: jest.fn().mockResolvedValue([{ createdAt: new Date('2026-08-15T11:00:00Z') }]) },
      clientMembership: { count: jest.fn(({ where }) => Promise.resolve(where.status === 'ACTIVE' ? 4 : 2)) },
      user: { count: jest.fn() },
      auditLog: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const access = { isSuper: jest.fn().mockReturnValue(false), requireTenant: jest.fn().mockResolvedValue({ id: tenantId }) };
    const service = new DashboardService(prisma as never, access as never);
    const result = await service.summary(actor, { range: '7d', tenantId });
    expect(access.requireTenant).toHaveBeenCalledWith(actor, tenantId);
    expect(prisma.project.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ tenantId }) }));
    expect(result.metrics).toEqual(expect.objectContaining({ projectsCreated: 1, personasCreated: 1, activeUsers: 4, pendingAccessRequests: 2 }));
  });

  it('fails closed when a non-super user omits tenant context', async () => {
    const access = { isSuper: jest.fn().mockReturnValue(false) };
    const service = new DashboardService({} as never, access as never);
    await expect(service.summary(actor, { range: '30d' })).rejects.toBeInstanceOf(ForbiddenException);
  });
});
