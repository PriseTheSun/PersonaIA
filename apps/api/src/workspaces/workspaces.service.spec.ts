import { WorkspacesService } from './workspaces.service';

describe('WorkspacesService folder semantics', () => {
  const tenantId = '10000000-0000-4000-8000-000000000001';
  const workspaceId = '20000000-0000-4000-8000-000000000002';
  const actor = {
    id: '30000000-0000-4000-8000-000000000003', tenantId, email: 'admin@test.dev', name: 'Admin',
    role: 'CLIENT_ADMIN' as const, tokenVersion: 0,
  };

  it('removes a workspace by ungrouping its projects without deleting them', async () => {
    const tx = {
      project: { updateMany: jest.fn().mockResolvedValue({ count: 3 }) },
      workspace: { update: jest.fn().mockResolvedValue({}) },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    };
    const prisma = {
      workspace: { findFirst: jest.fn().mockResolvedValue({ id: workspaceId, tenantId, isDefault: true }) },
      $transaction: jest.fn(async (operation: (client: typeof tx) => Promise<unknown>) => operation(tx)),
    };
    const access = {
      requireTenant: jest.fn().mockResolvedValue({ id: tenantId }),
      lockTenant: jest.fn().mockResolvedValue(undefined),
      lockWorkspace: jest.fn().mockResolvedValue(undefined),
    };
    const service = new WorkspacesService(prisma as never, access as never);

    await expect(service.remove(tenantId, workspaceId, actor)).resolves.toEqual({ success: true });
    expect(tx.project.updateMany).toHaveBeenCalledWith({ where: { tenantId, workspaceId }, data: { workspaceId: null } });
    expect(tx.workspace.update).toHaveBeenCalledWith({ where: { id: workspaceId }, data: { status: 'REMOVED' } });
    expect(tx.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ metadata: { ungroupedProjects: 3 } }),
    }));
  });
});
