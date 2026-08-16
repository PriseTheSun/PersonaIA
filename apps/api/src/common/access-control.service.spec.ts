import { ForbiddenException } from '@nestjs/common';
import { AccessControlService } from './access-control.service';

describe('AccessControlService permission resolution', () => {
  const tenantId = '10000000-0000-4000-8000-000000000001';
  const workspaceId = '20000000-0000-4000-8000-000000000002';
  const projectId = '30000000-0000-4000-8000-000000000003';
  const actor = { id: '40000000-0000-4000-8000-000000000004', tenantId, email: 'member@test.dev', name: 'Member', role: 'PROJECT_USER' as const, tokenVersion: 0 };

  function setup(projectRule: { level: string; effect: string } | null) {
    const prisma = {
      workspace: { findFirst: jest.fn().mockResolvedValue({ id: workspaceId, tenantId, status: 'ACTIVE' }) },
      clientMembership: { findUnique: jest.fn().mockResolvedValue({ role: 'CLIENT_MEMBER', status: 'ACTIVE' }) },
      workspaceMembership: {
        findUnique: jest.fn()
          .mockResolvedValueOnce({ role: 'WORKSPACE_MEMBER', status: 'ACTIVE', clientMembership: { status: 'ACTIVE' } })
          .mockResolvedValueOnce({ role: 'WORKSPACE_MEMBER', status: 'ACTIVE' }),
      },
      projectFunctionalPermission: { findUnique: jest.fn().mockResolvedValue(projectRule) },
      workspacePermission: { findUnique: jest.fn().mockResolvedValue({ level: 'ADMIN', effect: 'ALLOW' }) },
    };
    const service = new AccessControlService(prisma as never);
    jest.spyOn(service, 'requireProject').mockResolvedValue({ id: projectId, tenantId, workspaceId, status: 'ACTIVE' });
    return { prisma, service };
  }

  it('gives explicit project DENY priority over inherited workspace ADMIN', async () => {
    const { prisma, service } = setup({ level: 'READ', effect: 'DENY' });
    await expect(service.requireFeature(actor, {
      workspaceId, projectId, feature: 'PERSONA', level: 'READ',
    })).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.workspacePermission.findUnique).not.toHaveBeenCalled();
  });

  it('treats an explicit project READ as an override, not an addition to inherited ADMIN', async () => {
    const { prisma, service } = setup({ level: 'READ', effect: 'ALLOW' });
    await expect(service.requireFeature(actor, {
      workspaceId, projectId, feature: 'PERSONA', level: 'WRITE',
    })).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.workspacePermission.findUnique).not.toHaveBeenCalled();
  });

  it('authorizes an ungrouped project from its project membership preset', async () => {
    const prisma = {
      clientMembership: { findUnique: jest.fn().mockResolvedValue({ role: 'CLIENT_MEMBER', status: 'ACTIVE' }) },
      projectFunctionalPermission: { findUnique: jest.fn().mockResolvedValue(null) },
      projectMembership: { findUnique: jest.fn().mockResolvedValue({ permission: 'CONTRIBUTOR' }) },
    };
    const service = new AccessControlService(prisma as never);
    jest.spyOn(service, 'requireProject').mockResolvedValue({ id: projectId, tenantId, workspaceId: null, status: 'ACTIVE' });

    await expect(service.requireFeature(actor, {
      projectId, feature: 'PERSONA', level: 'WRITE',
    })).resolves.toEqual(expect.objectContaining({ id: projectId, workspaceId: null }));
  });
});
