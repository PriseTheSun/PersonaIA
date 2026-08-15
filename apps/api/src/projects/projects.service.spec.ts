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
    const service = new ProjectsService(prisma as never);
    await expect(service.updatePermission(foreignProject, foreignUser, { permission: 'VIEWER' }, actor)).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.project.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ id: foreignProject, tenantId: ownTenant }) }));
    expect(prisma.projectMembership.findFirst).not.toHaveBeenCalled();
  });

  it('blocks adding a valid user id belonging to another tenant', async () => {
    const prisma = {
      project: { findFirst: jest.fn().mockResolvedValue({ id: foreignProject }) },
      user: { findFirst: jest.fn().mockResolvedValue(null) }
    };
    const service = new ProjectsService(prisma as never);
    await expect(service.addMember(foreignProject, { userId: foreignUser, permission: 'VIEWER' }, actor)).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.user.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ id: foreignUser, tenantId: ownTenant }) }));
  });
});
