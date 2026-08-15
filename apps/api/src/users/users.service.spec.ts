import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { UsersService } from './users.service';

describe('UsersService access control', () => {
  const ownTenant = '10000000-0000-4000-8000-000000000001';
  const foreignTenant = '20000000-0000-4000-8000-000000000002';
  const targetId = '30000000-0000-4000-8000-000000000003';
  const clientActor = { id: '40000000-0000-4000-8000-000000000004', tenantId: ownTenant, email: 'admin@test.dev', name: 'Admin', role: 'CLIENT_ADMIN' as const, tokenVersion: 0 };
  const superActor = { ...clientActor, id: '50000000-0000-4000-8000-000000000005', tenantId: null, role: 'SUPER_ADMIN' as const };

  it('hides a cross-tenant target from a client administrator', async () => {
    const prisma = { user: { findUnique: jest.fn().mockResolvedValue({ id: targetId, tenantId: foreignTenant, role: 'PROJECT_USER', status: 'PENDING' }) } };
    const service = new UsersService(prisma as never, {} as never);
    await expect(service.updateAccess(targetId, { status: 'ACTIVE' }, clientActor)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('prevents a client administrator from promoting a project user', async () => {
    const prisma = { user: { findUnique: jest.fn().mockResolvedValue({ id: targetId, tenantId: ownTenant, role: 'PROJECT_USER', status: 'PENDING' }) } };
    const service = new UsersService(prisma as never, {} as never);
    await expect(service.updateAccess(targetId, { role: 'CLIENT_ADMIN' }, clientActor)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('clears project memberships and sessions when a super administrator grants platform access', async () => {
    const existing = { id: targetId, tenantId: ownTenant, role: 'PROJECT_USER', status: 'PENDING', name: 'Pessoa', email: 'pessoa@test.dev' };
    const tx = {
      projectMembership: { deleteMany: jest.fn().mockResolvedValue({ count: 2 }) },
      user: { update: jest.fn().mockResolvedValue({ ...existing, tenantId: null, role: 'SUPER_ADMIN', status: 'ACTIVE' }) },
      refreshSession: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      auditLog: { create: jest.fn().mockResolvedValue({}) }
    };
    const prisma = {
      user: { findUnique: jest.fn().mockResolvedValue(existing) },
      tenant: { findFirst: jest.fn().mockResolvedValue({ id: ownTenant }) },
      $transaction: jest.fn(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx))
    };
    const notifications = { resolveAccessRequest: jest.fn().mockResolvedValue(undefined) };
    const service = new UsersService(prisma as never, notifications as never);

    await service.updateAccess(targetId, { role: 'SUPER_ADMIN', status: 'ACTIVE', tenantId: null }, superActor);
    expect(tx.projectMembership.deleteMany).toHaveBeenCalledWith({ where: { userId: targetId } });
    expect(tx.refreshSession.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ userId: targetId }) }));
    expect(notifications.resolveAccessRequest).toHaveBeenCalledWith(tx, targetId);
    expect(tx.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: 'USER_ACCESS_APPROVED' }) }));
  });

  it('archives a pending request when an administrator rejects access', async () => {
    const existing = { id: targetId, tenantId: ownTenant, role: 'PROJECT_USER', status: 'PENDING', name: 'Pessoa', email: 'pessoa@test.dev' };
    const tx = {
      projectMembership: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
      user: { update: jest.fn().mockResolvedValue({ ...existing, status: 'ARCHIVED' }) },
      refreshSession: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
      auditLog: { create: jest.fn().mockResolvedValue({}) }
    };
    const prisma = {
      user: { findUnique: jest.fn().mockResolvedValue(existing) },
      tenant: { findFirst: jest.fn().mockResolvedValue({ id: ownTenant }) },
      $transaction: jest.fn(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx))
    };
    const notifications = { resolveAccessRequest: jest.fn().mockResolvedValue(undefined) };
    const service = new UsersService(prisma as never, notifications as never);

    await service.updateAccess(targetId, { status: 'ARCHIVED' }, clientActor);

    expect(tx.user.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: targetId },
      data: expect.objectContaining({ status: 'ARCHIVED' })
    }));
    expect(notifications.resolveAccessRequest).toHaveBeenCalledWith(tx, targetId);
    expect(tx.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ action: 'USER_ACCESS_REJECTED' })
    }));
  });
});
