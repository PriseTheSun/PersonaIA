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
      workspaceMembership: { findUnique: jest.fn().mockResolvedValue(null) },
    };
    const access = { requireProject: jest.fn().mockResolvedValue({ id: foreignProject, tenantId: ownTenant, workspaceId: '50000000-0000-4000-8000-000000000005' }) };
    const service = new ProjectsService(prisma as never, access as never);
    await expect(service.addMember(foreignProject, { userId: foreignUser, permission: 'VIEWER' }, actor)).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.workspaceMembership.findUnique).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ workspaceId_userId: expect.objectContaining({ userId: foreignUser }) }),
    }));
  });
});
