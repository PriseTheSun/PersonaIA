import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AuthContext } from '@/features/auth/auth-store';
import { I18nProvider } from '@/i18n/i18n-provider';
import { useApiQuery } from '@/hooks/use-api-query';
import { ProjectsPage } from './projects-page';

vi.mock('@/hooks/use-api-query', () => ({ useApiQuery: vi.fn() }));
vi.mock('@/lib/api', () => ({
  apiRequest: vi.fn(),
  csrfHeaders: vi.fn(() => ({})),
  setScopeContext: vi.fn(),
}));

describe('ProjectsPage', () => {
  it('exibe projetos em tabela e concentra as ações no menu de três pontos', async () => {
    window.localStorage.setItem('personaia.locale', 'pt-BR');
    const tenantId = '10000000-0000-4000-8000-000000000001';
    const workspaceId = '20000000-0000-4000-8000-000000000002';
    const projectId = '30000000-0000-4000-8000-000000000003';
    const retry = vi.fn();
    vi.mocked(useApiQuery).mockImplementation((_, dependencies = []) => dependencies.length === 2
      ? {
          status: 'success',
          data: [{
            id: projectId,
            name: 'Pesquisa nacional',
            description: 'Estudo de comportamento',
            workspaceId,
            workspace: { id: workspaceId, name: 'Pesquisas 2026' },
            status: 'ACTIVE',
            memberCount: 7,
            accessCode: {
              code: 'ABCDEFGHJKLM',
              expiresAt: new Date(Date.now() + 10 * 60_000).toISOString(),
              serverTime: new Date().toISOString(),
            },
            createdAt: '2026-08-15T12:00:00.000Z',
            updatedAt: '2026-08-16T12:00:00.000Z',
          }],
          error: null,
          retry,
        } as never
      : {
          status: 'success',
          data: [{
            id: workspaceId,
            tenantId,
            name: 'Pesquisas 2026',
            status: 'ACTIVE',
            isDefault: false,
            memberCount: 7,
            projectCount: 1,
            personaCount: 0,
            questionnaireCount: 0,
          }],
          error: null,
          retry,
        } as never);

    const context = {
      tenantId,
      tenantName: 'Organização Acme',
      clientRole: 'CLIENT_ADMIN' as const,
      status: 'ACTIVE' as const,
      workspaces: [{ id: workspaceId, name: 'Pesquisas 2026', role: 'WORKSPACE_ADMIN' as const, status: 'ACTIVE' as const, permissions: [] }],
    };
    const user = userEvent.setup();
    render(
      <I18nProvider>
        <TooltipProvider>
          <AuthContext.Provider value={{
            status: 'authenticated',
            user: { id: 'admin-1', name: 'Admin', email: 'admin@acme.dev', role: 'CLIENT_ADMIN', status: 'ACTIVE', contexts: [context] },
            activeScope: { tenantId, workspaceId }, activeContext: context, effectiveRole: 'CLIENT_ADMIN',
            login: vi.fn(), logout: vi.fn(), refresh: vi.fn(), selectScope: vi.fn(),
          }}>
            <MemoryRouter initialEntries={[`/projects?tenant=${tenantId}&workspace=${workspaceId}`]}><ProjectsPage /></MemoryRouter>
          </AuthContext.Provider>
        </TooltipProvider>
      </I18nProvider>,
    );

    expect(screen.getByRole('columnheader', { name: 'Nome Projeto' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Cód. Projeto' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Usuários Vinculados' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Data Criação' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Ações' })).toBeInTheDocument();

    const row = screen.getByRole('row', { name: /Pesquisa nacional/ });
    const cells = within(row).getAllByRole('cell');
    expect(cells[1]).toHaveTextContent('ABCDEFGHJKLM');
    expect(cells[2]).toHaveTextContent('7');
    expect(cells[3]).toHaveTextContent('15 de ago. de 2026');

    await user.click(within(row).getByRole('button', { name: 'Ações: Pesquisa nacional' }));
    expect(screen.getByRole('menuitem', { name: 'Organizar' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Permissões' })).toHaveAttribute('href', `/permissions?tenant=${tenantId}&workspace=${workspaceId}&project=${projectId}`);
  });
});
