import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { AuthContext, type AuthContextValue } from '@/features/auth/auth-store';
import { useActiveScope } from './use-active-scope';

function ScopeProbe() {
  const scope = useActiveScope();
  return <output>{`${scope.tenantId ?? 'none'}:${scope.workspaceId ?? 'all'}`}</output>;
}

function renderScope(value: AuthContextValue, initialEntry: string) {
  return render(
    <AuthContext.Provider value={value}>
      <MemoryRouter initialEntries={[initialEntry]}><ScopeProbe /></MemoryRouter>
    </AuthContext.Provider>,
  );
}

describe('useActiveScope', () => {
  it('never inherits a workspace from another tenant named in the URL', async () => {
    const selectScope = vi.fn();
    renderScope({
      status: 'authenticated',
      user: { id: 'super-1', name: 'Super', email: 'super@example.com', role: 'SUPER_ADMIN', status: 'ACTIVE' },
      activeScope: { tenantId: 'tenant-a', workspaceId: 'workspace-a' },
      activeContext: null,
      effectiveRole: 'SUPER_ADMIN',
      login: vi.fn(), logout: vi.fn(), refresh: vi.fn(), selectScope,
    }, '/?tenant=tenant-b');

    expect(screen.getByText('tenant-b:all')).toBeInTheDocument();
    await waitFor(() => expect(selectScope).toHaveBeenCalledWith({ tenantId: 'tenant-b' }));
  });

  it('selects the first active workspace when a scoped member opens a tenant link', async () => {
    const selectScope = vi.fn();
    const contexts = [{
      tenantId: 'tenant-b', tenantName: 'Client B', clientRole: 'CLIENT_MEMBER' as const, status: 'ACTIVE' as const,
      workspaces: [{ id: 'workspace-b', name: 'Research B', role: 'WORKSPACE_MEMBER' as const, status: 'ACTIVE' as const, permissions: [] }],
    }];
    renderScope({
      status: 'authenticated',
      user: { id: 'member-1', name: 'Member', email: 'member@example.com', role: 'WORKSPACE_MEMBER', status: 'ACTIVE', contexts },
      activeScope: { tenantId: 'tenant-a', workspaceId: 'workspace-a' },
      activeContext: null,
      effectiveRole: 'WORKSPACE_MEMBER',
      login: vi.fn(), logout: vi.fn(), refresh: vi.fn(), selectScope,
    }, '/?tenant=tenant-b');

    expect(screen.getByText('tenant-b:workspace-b')).toBeInTheDocument();
    await waitFor(() => expect(selectScope).toHaveBeenCalledWith({ tenantId: 'tenant-b', workspaceId: 'workspace-b' }));
  });
});
