import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { I18nProvider } from '@/i18n/i18n-provider';
import { AuthContext } from '@/features/auth/auth-store';
import { useApiQuery } from '@/hooks/use-api-query';
import { apiRequest } from '@/lib/api';
import { AccessControlPage } from './access-control-page';

vi.mock('@/hooks/use-api-query', () => ({ useApiQuery: vi.fn() }));
vi.mock('@/lib/api', () => ({
  ApiError: class ApiError extends Error {},
  apiRequest: vi.fn(),
  csrfHeaders: vi.fn(() => ({ 'X-CSRF-Token': 'test' })),
}));

describe('AccessControlPage project assignment', () => {
  beforeEach(() => {
    localStorage.setItem('personaia.locale', 'pt-BR');
    vi.mocked(apiRequest).mockResolvedValue({});
  });

  it('lets an administrator choose the initial project while approving a pending registration', async () => {
    const tenantId = '10000000-0000-4000-8000-000000000001';
    const userId = '20000000-0000-4000-8000-000000000002';
    const projectId = '30000000-0000-4000-8000-000000000003';
    const retry = vi.fn();
    const membershipResult = { status: 'success', data: [{
        id: '40000000-0000-4000-8000-000000000004', tenantId, userId,
        role: 'CLIENT_MEMBER', status: 'PENDING_APPROVAL', workspaceCount: 0,
        user: { id: userId, name: 'Pessoa Teste', email: 'pessoa@teste.dev', role: 'PROJECT_USER', status: 'PENDING_APPROVAL' },
      }], error: null, retry };
    const projectsResult = { status: 'success', data: [{
        id: projectId, name: 'Pesquisa nacional', status: 'ACTIVE', memberCount: 0,
        updatedAt: '2026-08-15T20:00:00.000Z',
      }], error: null, retry: vi.fn() };
    vi.mocked(useApiQuery).mockImplementation((_, dependencies = []) => {
      if (dependencies.length === 1 && dependencies[0] === tenantId) return membershipResult as never;
      if (dependencies.length === 2 && dependencies[0] === tenantId && dependencies[1] === 'CLIENT') return projectsResult as never;
      return { status: 'success', data: [], error: null, retry: vi.fn() } as never;
    });
    const context = { tenantId, tenantName: 'Organização Teste', clientRole: 'CLIENT_ADMIN' as const, status: 'ACTIVE' as const, workspaces: [] };
    const user = userEvent.setup();
    render(
      <I18nProvider>
        <AuthContext.Provider value={{
          status: 'authenticated',
          user: { id: 'admin-1', name: 'Admin', email: 'admin@teste.dev', role: 'CLIENT_ADMIN', status: 'ACTIVE', contexts: [context] },
          activeScope: { tenantId }, activeContext: context, effectiveRole: 'CLIENT_ADMIN',
          login: vi.fn(), logout: vi.fn(), refresh: vi.fn(), selectScope: vi.fn(),
        }}>
          <MemoryRouter initialEntries={[`/access-control?tenant=${tenantId}&status=PENDING`]}><AccessControlPage /></MemoryRouter>
        </AuthContext.Provider>
      </I18nProvider>,
    );

    expect(screen.getByRole('columnheader', { name: 'Usuário' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Perfil' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Projeto solicitado' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Aprovar' })).not.toBeInTheDocument();

    await user.click(screen.getAllByRole('button', { name: 'Ações: Pessoa Teste' })[0]);
    await user.click(await screen.findByRole('menuitem', { name: 'Aprovar' }));
    expect(screen.getByRole('dialog')).toHaveTextContent('Aprovar acesso de Pessoa Teste');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Projeto inicial (opcional)' }), projectId);
    await user.click(screen.getByRole('button', { name: 'Aprovar acesso' }));

    await waitFor(() => expect(apiRequest).toHaveBeenCalledWith(
      `/tenants/${tenantId}/memberships/${userId}`,
      expect.anything(),
      expect.objectContaining({ method: 'PATCH', body: { status: 'ACTIVE', projectId } }),
    ));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await user.click(screen.getAllByRole('button', { name: 'Ações: Pessoa Teste' })[0]);
    await user.click(await screen.findByRole('menuitem', { name: 'Alterar acesso' }));
    expect(screen.getByRole('dialog')).toHaveTextContent('Acesso de Pessoa Teste');
  });
});
