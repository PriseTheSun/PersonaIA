import { ConflictException, ForbiddenException } from '@nestjs/common';
import { UsersService } from './users.service';

describe('UsersService global identity access', () => {
  const targetId = '30000000-0000-4000-8000-000000000003';
  const tenantId = '10000000-0000-4000-8000-000000000001';
  const clientActor = { id: '40000000-0000-4000-8000-000000000004', tenantId, email: 'admin@test.dev', name: 'Admin', role: 'CLIENT_ADMIN' as const, tokenVersion: 0 };
  const superActor = { ...clientActor, id: '50000000-0000-4000-8000-000000000005', tenantId: null, role: 'SUPER_ADMIN' as const };

  it('rejects scoped admins from the platform identity service', async () => {
    const service = new UsersService({} as never);
    await expect(service.listAccess(clientActor)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('protects the last active super admin under a serialized transaction', async () => {
    const existing = { id: targetId, tenantId: null, role: 'SUPER_ADMIN', status: 'ACTIVE', name: 'Super', email: 'super@test.dev' };
    const tx = {
      $executeRaw: jest.fn().mockResolvedValue(1),
      user: { count: jest.fn().mockResolvedValue(1), update: jest.fn() },
      refreshSession: { updateMany: jest.fn() }, auditLog: { create: jest.fn() },
    };
    const prisma = {
      user: { findUnique: jest.fn().mockResolvedValue(existing) },
      clientMembership: { findUnique: jest.fn().mockResolvedValue({ role: 'CLIENT_MEMBER', status: 'ACTIVE' }) },
      $transaction: jest.fn(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx)),
    };
    const service = new UsersService(prisma as never);
    await expect(service.updateAccess(targetId, { role: 'PROJECT_USER', tenantId }, superActor)).rejects.toBeInstanceOf(ConflictException);
    expect(tx.user.update).not.toHaveBeenCalled();
  });

  it('changes the global context without deleting independent scoped memberships', async () => {
    const existing = { id: targetId, tenantId, role: 'PROJECT_USER', status: 'ACTIVE', name: 'Pessoa', email: 'pessoa@test.dev' };
    const tx = {
      $executeRaw: jest.fn().mockResolvedValue(1),
      user: { count: jest.fn(), update: jest.fn().mockResolvedValue({ ...existing, role: 'SUPER_ADMIN', tenantId: null }) },
      refreshSession: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
      clientMembership: { deleteMany: jest.fn() },
    };
    const prisma = {
      user: { findUnique: jest.fn().mockResolvedValue(existing) },
      $transaction: jest.fn(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx)),
    };
    const service = new UsersService(prisma as never);
    await service.updateAccess(targetId, { role: 'SUPER_ADMIN', status: 'ACTIVE', tenantId: null }, superActor);
    expect(tx.user.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ role: 'SUPER_ADMIN', tenantId: null }) }));
    expect(tx.clientMembership.deleteMany).not.toHaveBeenCalled();
  });

  it('lets a super admin approve an unscoped registration by choosing an organization', async () => {
    const existing = {
      id: targetId, tenantId: null, role: 'PROJECT_USER', status: 'PENDING_APPROVAL',
      name: 'Pessoa', email: 'pessoa@test.dev',
    };
    const membership = {
      id: '60000000-0000-4000-8000-000000000006', tenantId, userId: targetId,
      role: 'CLIENT_MEMBER', status: 'ACTIVE', requestedProjectId: null,
    };
    const tx = {
      $executeRaw: jest.fn().mockResolvedValue(1),
      tenant: { findFirst: jest.fn().mockResolvedValue({ id: tenantId }) },
      clientMembership: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue(membership),
        update: jest.fn(),
      },
      project: { findFirst: jest.fn() },
      projectMembership: { upsert: jest.fn() },
      user: { count: jest.fn(), update: jest.fn().mockResolvedValue({ ...existing, tenantId, status: 'ACTIVE' }) },
      refreshSession: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    };
    const prisma = {
      user: { findUnique: jest.fn().mockResolvedValue(existing) },
      $transaction: jest.fn(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx)),
    };
    const notifications = { resolveAccessRequest: jest.fn(), resolveMissingProjectAccess: jest.fn() };
    const service = new UsersService(prisma as never, notifications as never);

    await service.updateAccess(targetId, { role: 'PROJECT_USER', status: 'ACTIVE', tenantId }, superActor);

    expect(tx.clientMembership.create).toHaveBeenCalledWith({
      data: { tenantId, userId: targetId, role: 'CLIENT_MEMBER', status: 'ACTIVE' },
    });
    expect(notifications.resolveAccessRequest).toHaveBeenCalledWith(tx, targetId, null);
    expect(tx.user.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ tenantId, role: 'PROJECT_USER', status: 'ACTIVE' }),
    }));
  });
});
