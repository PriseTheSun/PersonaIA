import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { AuthContext } from '@/features/auth/auth-store';
import { I18nProvider } from '@/i18n/i18n-provider';
import { AccessControlPage } from '@/features/access-control/access-control-page';
import { AdminsPage } from '@/features/admins/admins-page';
import { PersonasPage } from '@/features/assets/personas-page';
import { QuestionnairesPage } from '@/features/assets/questionnaires-page';
import { PermissionsPage } from '@/features/permissions/permissions-page';
import { PreferencesPage } from '@/features/preferences/preferences-page';
import { ProjectsPage } from '@/features/projects/projects-page';
import { ForbiddenPage, NotFoundPage } from '@/features/errors/error-pages';
import { TenantsPage } from '@/features/tenants/tenants-page';
import { UsersPage } from '@/features/users/users-page';
import { WorkspacesPage } from '@/features/workspaces/workspaces-page';

vi.mock('@/hooks/use-api-query', () => ({
  useApiQuery: vi.fn(() => ({ status: 'success', data: [], error: null, retry: vi.fn() })),
}));

vi.mock('@/lib/api', () => ({
  ApiError: class ApiError extends Error {},
  apiRequest: vi.fn(),
  apiVoid: vi.fn(),
  apiBlob: vi.fn(),
  csrfHeaders: vi.fn(() => ({})),
  setScopeContext: vi.fn(),
}));

const context = {
  tenantId: 'tenant-1', tenantName: 'Client', clientRole: 'CLIENT_ADMIN' as const, status: 'ACTIVE' as const,
  workspaces: [{ id: 'workspace-1', name: 'Research', role: 'WORKSPACE_ADMIN' as const, status: 'ACTIVE' as const, permissions: [] }],
};

function renderAuthenticatedPage(Page: () => React.JSX.Element) {
  window.localStorage.setItem('personaia.locale', 'pt-BR');
  return render(
    <I18nProvider>
      <AuthContext.Provider value={{
        status: 'authenticated',
        user: { id: 'super-1', name: 'Super', email: 'super@example.com', role: 'SUPER_ADMIN', status: 'ACTIVE', contexts: [context] },
        activeScope: { tenantId: context.tenantId, workspaceId: context.workspaces[0].id },
        activeContext: context,
        effectiveRole: 'SUPER_ADMIN',
        login: vi.fn(), logout: vi.fn(), refresh: vi.fn(), selectScope: vi.fn(),
      }}>
        <MemoryRouter initialEntries={[`/?tenant=${context.tenantId}&workspace=${context.workspaces[0].id}`]}><Page /></MemoryRouter>
      </AuthContext.Provider>
    </I18nProvider>,
  );
}

describe('authenticated routes remain console-clean', () => {
  it.each([
    ['tenants', TenantsPage, 'Organizações'],
    ['administrators', AdminsPage, 'Administradores'],
    ['workspaces', WorkspacesPage, 'Workspaces'],
    ['projects', ProjectsPage, 'Projetos'],
    ['users', UsersPage, 'Usuários'],
    ['permissions', PermissionsPage, 'Permissões funcionais'],
    ['personas', PersonasPage, 'Personas'],
    ['questionnaires', QuestionnairesPage, 'Questionários'],
    ['access-control', AccessControlPage, 'Controle de acessos'],
    ['preferences', PreferencesPage, 'Preferências'],
    ['403', ForbiddenPage, 'Você não tem acesso a esta área'],
    ['404', NotFoundPage, 'Página não encontrada'],
  ] as const)('renders %s without console warnings or errors', (_route, Page, title) => {
    renderAuthenticatedPage(Page);
    expect(screen.getByRole('heading', { level: 1, name: title })).toBeInTheDocument();
  });
});
