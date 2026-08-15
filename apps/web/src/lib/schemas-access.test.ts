import { describe, expect, it } from 'vitest';
import { userSchema, workspaceMembershipSchema } from './schemas';

describe('multi-client access contracts', () => {
  it('keeps one identity linked to independent clients and workspaces', () => {
    const result = userSchema.safeParse({
      id: 'user-1',
      name: 'Shared identity',
      email: 'shared@example.com',
      role: 'WORKSPACE_MEMBER',
      status: 'ACTIVE',
      contexts: [
        { tenantId: 'tenant-a', tenantName: 'Client A', clientRole: 'CLIENT_MEMBER', status: 'ACTIVE', workspaces: [{ id: 'workspace-a', name: 'Research A', role: 'WORKSPACE_MEMBER', status: 'ACTIVE', permissions: [] }] },
        { tenantId: 'tenant-b', tenantName: 'Client B', clientRole: 'CLIENT_ADMIN', status: 'ACTIVE', workspaces: [{ id: 'workspace-b', name: 'Research B', role: 'WORKSPACE_ADMIN', status: 'ACTIVE', permissions: [] }] },
      ],
    });

    expect(result.success).toBe(true);
    if (result.success) expect(result.data.contexts).toHaveLength(2);
  });

  it('represents inherited and explicit permissions without collapsing deny', () => {
    const result = workspaceMembershipSchema.safeParse({
      workspaceId: 'workspace-a',
      userId: 'user-1',
      role: 'WORKSPACE_MEMBER',
      status: 'ACTIVE',
      user: { id: 'user-1', name: 'Member', email: 'member@example.com', role: 'WORKSPACE_MEMBER', status: 'ACTIVE' },
      permissions: [{ feature: 'RESEARCH', level: 'WRITE', effect: 'DENY', source: 'WORKSPACE' }],
      effectivePermissions: [{ feature: 'RESEARCH', level: 'WRITE', effect: 'DENY', inherited: false }],
    });

    expect(result.success).toBe(true);
    if (result.success) expect(result.data.effectivePermissions[0]?.effect).toBe('DENY');
  });
});
