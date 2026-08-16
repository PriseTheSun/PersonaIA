import { ClientMembershipsService } from './client-memberships.service';

describe('ClientMembershipsService project access request approval', () => {
  it('activates the organization account and links the requested active project atomically', async () => {
    const tenantId = '10000000-0000-4000-8000-000000000001';
    const userId = '20000000-0000-4000-8000-000000000002';
    const projectId = '30000000-0000-4000-8000-000000000003';
    const existing = {
      id: '40000000-0000-4000-8000-000000000004', tenantId, userId,
      role: 'CLIENT_MEMBER', status: 'PENDING_APPROVAL', requestedProjectId: projectId,
    };
    const membershipUpdate = jest.fn()
      .mockResolvedValueOnce({ ...existing, status: 'ACTIVE' })
      .mockResolvedValueOnce({ ...existing, status: 'ACTIVE', requestedProjectId: null });
    const tx = {
      clientMembership: { update: membershipUpdate },
      user: { findUniqueOrThrow: jest.fn().mockResolvedValue({ id: userId, status: 'ACTIVE' }) },
      project: { findFirst: jest.fn().mockResolvedValue({ id: projectId }) },
      projectMembership: { upsert: jest.fn().mockResolvedValue({}) },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    };
    const prisma = {
      clientMembership: { findUnique: jest.fn().mockResolvedValue(existing) },
      $transaction: jest.fn(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx)),
    };
    const access = {
      requireTenant: jest.fn().mockResolvedValue({ id: tenantId }),
      lockTenant: jest.fn().mockResolvedValue(undefined),
    };
    const notifications = {
      resolveAccessRequest: jest.fn().mockResolvedValue(undefined),
      resolveMissingProjectAccess: jest.fn().mockResolvedValue(undefined),
    };
    const service = new ClientMembershipsService(prisma as never, access as never, notifications as never);
    const actor = {
      id: '50000000-0000-4000-8000-000000000005', tenantId: null,
      email: 'admin@test.dev', name: 'Admin', role: 'SUPER_ADMIN' as const, tokenVersion: 0,
    };

    await service.update(tenantId, userId, { status: 'ACTIVE' }, actor);

    expect(tx.projectMembership.upsert).toHaveBeenCalledWith({
      where: { projectId_userId: { projectId, userId } },
      update: {},
      create: { tenantId, projectId, userId, permission: 'VIEWER' },
    });
    expect(membershipUpdate).toHaveBeenNthCalledWith(2, {
      where: { id: existing.id },
      data: { requestedProjectId: null },
    });
    expect(notifications.resolveAccessRequest).toHaveBeenCalledWith(tx, userId, tenantId);
    expect(notifications.resolveMissingProjectAccess).toHaveBeenCalledWith(tx, userId, tenantId);
  });

  it('lets an administrator choose a project while approving a registration that had no code', async () => {
    const tenantId = '10000000-0000-4000-8000-000000000001';
    const userId = '20000000-0000-4000-8000-000000000002';
    const projectId = '30000000-0000-4000-8000-000000000003';
    const existing = {
      id: '40000000-0000-4000-8000-000000000004', tenantId, userId,
      role: 'CLIENT_MEMBER', status: 'PENDING_APPROVAL', requestedProjectId: null,
    };
    const tx = {
      clientMembership: { update: jest.fn().mockResolvedValue({ ...existing, status: 'ACTIVE', requestedProjectId: projectId }) },
      user: { findUniqueOrThrow: jest.fn().mockResolvedValue({ id: userId, status: 'ACTIVE' }) },
      project: { findFirst: jest.fn().mockResolvedValue({ id: projectId }) },
      projectMembership: { upsert: jest.fn().mockResolvedValue({}) },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    };
    const prisma = {
      clientMembership: { findUnique: jest.fn().mockResolvedValue(existing) },
      project: { findFirst: jest.fn().mockResolvedValue({ id: projectId }) },
      $transaction: jest.fn(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx)),
    };
    const access = { requireTenant: jest.fn().mockResolvedValue({ id: tenantId }), lockTenant: jest.fn().mockResolvedValue(undefined) };
    const notifications = { resolveAccessRequest: jest.fn(), resolveMissingProjectAccess: jest.fn() };
    const service = new ClientMembershipsService(prisma as never, access as never, notifications as never);
    const actor = {
      id: '50000000-0000-4000-8000-000000000005', tenantId: null,
      email: 'admin@test.dev', name: 'Admin', role: 'SUPER_ADMIN' as const, tokenVersion: 0,
    };

    await service.update(tenantId, userId, { status: 'ACTIVE', projectId }, actor);

    expect(prisma.project.findFirst).toHaveBeenCalledWith({
      where: { id: projectId, tenantId, status: 'ACTIVE' },
      select: { id: true },
    });
    expect(tx.projectMembership.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { projectId_userId: { projectId, userId } },
      create: expect.objectContaining({ tenantId, projectId, userId, permission: 'VIEWER' }),
    }));
  });
});
