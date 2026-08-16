import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthContext } from '@/features/auth/auth-store';
import { I18nProvider } from '@/i18n/i18n-provider';
import { useApiQuery } from '@/hooks/use-api-query';
import { apiRequest } from '@/lib/api';
import { AssetsPage } from './assets-page';

const selectWorkspace = vi.fn();

vi.mock('@/hooks/use-active-scope', () => ({
  useActiveScope: () => ({
    tenantId: 'tenant-1',
    workspaceId: 'workspace-1',
    selectTenant: vi.fn(),
    selectWorkspace,
  }),
}));
vi.mock('@/hooks/use-api-query', () => ({ useApiQuery: vi.fn() }));
vi.mock('@/lib/api', () => ({ apiRequest: vi.fn(), apiVoid: vi.fn(), csrfHeaders: vi.fn(() => ({})) }));

describe('Questionnaire creation', () => {
  beforeEach(() => {
    window.localStorage.setItem('personaia.locale', 'pt-BR');
    selectWorkspace.mockReset();
    vi.mocked(apiRequest).mockReset().mockResolvedValue({});
    vi.mocked(useApiQuery).mockReturnValue({ status: 'success', data: [], error: null, retry: vi.fn() } as never);
  });

  it('salva na organização sem workspace mesmo quando o administrador está filtrando um workspace', async () => {
    const user = userEvent.setup();
    const context = {
      tenantId: 'tenant-1', tenantName: 'Organização Alfa', clientRole: 'CLIENT_ADMIN' as const, status: 'ACTIVE' as const,
      workspaces: [{ id: 'workspace-1', name: 'Pesquisa', role: 'WORKSPACE_ADMIN' as const, status: 'ACTIVE' as const, permissions: [] }],
    };
    render(
      <I18nProvider>
        <AuthContext.Provider value={{
          status: 'authenticated',
          user: { id: 'admin-1', name: 'Admin', email: 'admin@example.com', role: 'CLIENT_ADMIN', status: 'ACTIVE', contexts: [context] },
          activeScope: { tenantId: 'tenant-1', workspaceId: 'workspace-1' }, activeContext: context, effectiveRole: 'CLIENT_ADMIN',
          login: vi.fn(), logout: vi.fn(), refresh: vi.fn(), selectScope: vi.fn(),
        }}>
          <AssetsPage kind="questionnaires" />
        </AuthContext.Provider>
      </I18nProvider>,
    );

    await user.click(screen.getByRole('button', { name: 'Novo questionário' }));
    const dialog = screen.getByRole('dialog', { name: 'Criar questionário' });
    expect(dialog).toHaveTextContent('sem exigir workspace');
    await user.type(within(dialog).getByRole('textbox', { name: 'Nome' }), 'Pesquisa de hábitos');
    await user.click(within(dialog).getByRole('button', { name: 'Novo questionário' }));

    await waitFor(() => expect(apiRequest).toHaveBeenCalledWith('/tenants/tenant-1/questionnaires', expect.anything(), expect.objectContaining({
      method: 'POST',
      body: expect.objectContaining({ name: 'Pesquisa de hábitos', workspaceIds: [] }),
    })));
    expect(selectWorkspace).toHaveBeenCalledWith('');
  });
});
