import { NotFoundException } from '@nestjs/common';
import { ProjectsService } from './projects.service';

describe('ProjectsService tenant isolation', () => {
  const ownTenant = '10000000-0000-4000-8000-000000000001';
  const foreignProject = '20000000-0000-4000-8000-000000000002';
  const foreignUser = '30000000-0000-4000-8000-000000000003';
  const actor = { id: '40000000-0000-4000-8000-000000000004', tenantId: ownTenant, email: 'admin@test.dev', name: 'Admin', role: 'CLIENT_ADMIN' as const, tokenVersion: 0 };

  it('blocks an IDOR using a valid project id from another tenant', async () => {
    const prisma = {
      project: { findFirst: jest.fn().mockResolvedValue(null) },
      projectMembership: { findFirst: jest.fn() }
    };
    const access = { requireProject: jest.fn().mockRejectedValue(new NotFoundException()) };
    const service = new ProjectsService(prisma as never, access as never);
    await expect(service.updatePermission(foreignProject, foreignUser, { permission: 'VIEWER' }, actor)).rejects.toBeInstanceOf(NotFoundException);
    expect(access.requireProject).toHaveBeenCalledWith(actor, foreignProject, true);
    expect(prisma.projectMembership.findFirst).not.toHaveBeenCalled();
  });

  it('blocks adding a valid user id belonging to another tenant', async () => {
    const prisma = {
      clientMembership: { findUnique: jest.fn().mockResolvedValue(null) },
    };
    const access = { requireProject: jest.fn().mockResolvedValue({ id: foreignProject, tenantId: ownTenant, workspaceId: '50000000-0000-4000-8000-000000000005' }) };
    const service = new ProjectsService(prisma as never, access as never);
    await expect(service.addMember(foreignProject, { userId: foreignUser, permission: 'VIEWER' }, actor)).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.clientMembership.findUnique).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ tenantId_userId: { tenantId: ownTenant, userId: foreignUser } }),
    }));
  });

  it('creates a project directly in the organization without a workspace', async () => {
    const created = { id: foreignProject, tenantId: ownTenant, workspaceId: null, name: 'Pesquisa', slug: 'pesquisa' };
    const tx = {
      project: { create: jest.fn().mockResolvedValue(created) },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    };
    const prisma = {
      $transaction: jest.fn(async (operation: (client: typeof tx) => Promise<unknown>) => operation(tx)),
    };
    const access = {
      requireTenant: jest.fn().mockResolvedValue({ id: ownTenant }),
      lockTenant: jest.fn().mockResolvedValue(undefined),
    };
    const service = new ProjectsService(prisma as never, access as never);

    await expect(service.create({ tenantId: ownTenant, name: 'Pesquisa' }, actor)).resolves.toEqual(created);
    expect(access.requireTenant).toHaveBeenCalledWith(actor, ownTenant, true);
    expect(tx.project.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ tenantId: ownTenant, workspaceId: null }),
    }));
    expect(tx.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ metadata: { workspaceId: null } }),
    }));
  });

  it('blocks grouping a project in a workspace from another organization', async () => {
    const foreignWorkspace = '50000000-0000-4000-8000-000000000005';
    const prisma = { $transaction: jest.fn() };
    const access = {
      requireProject: jest.fn().mockResolvedValue({ id: foreignProject, tenantId: ownTenant, workspaceId: null }),
      requireTenant: jest.fn().mockResolvedValue({ id: ownTenant }),
      requireWorkspace: jest.fn().mockResolvedValue({ id: foreignWorkspace, tenantId: '60000000-0000-4000-8000-000000000006' }),
    };
    const service = new ProjectsService(prisma as never, access as never);

    await expect(service.update(foreignProject, { workspaceId: foreignWorkspace }, actor)).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
