import { DashboardService } from './dashboard.service';

describe('DashboardService', () => {
  const tenantId = '10000000-0000-4000-8000-000000000001';
  const actor = {
    id: '20000000-0000-4000-8000-000000000002',
    tenantId,
    email: 'admin@cliente.dev',
    name: 'Admin',
    role: 'CLIENT_ADMIN' as const,
    tokenVersion: 0,
  };

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-08-15T15:00:00.000Z'));
  });

  afterEach(() => jest.useRealTimers());

  it('returns tenant-scoped current metrics and daily creation buckets', async () => {
    const prisma = {
      project: {
        findMany: jest.fn().mockResolvedValue([
          { createdAt: new Date('2026-08-10T12:00:00.000Z') },
          { createdAt: new Date('2026-08-15T10:00:00.000Z') },
        ]),
      },
      user: {
        count: jest.fn(({ where }) => Promise.resolve(where.status === 'ACTIVE' ? 14 : 3)),
      },
      auditLog: {
        findMany: jest.fn(({ where }) => Promise.resolve(where?.action === 'PERSONA_CREATED'
          ? [{ createdAt: new Date('2026-08-15T11:00:00.000Z') }]
          : [])),
      },
    };
    const service = new DashboardService(prisma as never);

    const result = await service.summary(actor, '7d');

    expect(prisma.project.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ tenantId }),
    }));
    expect(prisma.auditLog.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ tenantId, action: 'PERSONA_CREATED', targetType: 'Persona' }),
    }));
    expect(prisma.user.count).toHaveBeenCalledWith({ where: { tenantId, status: 'ACTIVE' } });
    expect(prisma.user.count).toHaveBeenCalledWith({ where: { tenantId, status: 'PENDING' } });
    expect(result.metrics).toEqual(expect.objectContaining({
      projectsCreated: 2,
      personasCreated: 1,
      activeUsers: 14,
      pendingAccessRequests: 3,
    }));
    expect(result.series).toHaveLength(7);
    expect(result.series.at(-1)).toEqual(expect.objectContaining({
      periodStart: '2026-08-15T00:00:00.000Z',
      projectsCreated: 1,
      personasCreated: 1,
    }));
  });

  it('does not expose tenant-wide access metrics to a project user', async () => {
    const prisma = {
      projectMembership: { count: jest.fn().mockResolvedValue(2) },
    };
    const service = new DashboardService(prisma as never);

    const result = await service.summary({ ...actor, role: 'PROJECT_USER' }, '30d');

    expect(result.metrics).toEqual(expect.objectContaining({
      accessibleProjects: 2,
      activeUsers: 0,
      pendingAccessRequests: 0,
    }));
    expect(result.recentActivity).toEqual([]);
  });

  it('fails closed when a client administrator has no tenant context', async () => {
    const service = new DashboardService({} as never);

    await expect(service.summary({ ...actor, tenantId: null }, '30d')).rejects.toThrow('Contexto de organização inválido.');
  });
});
