import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthContext } from '@/features/auth/auth-store';
import { useApiQuery } from '@/hooks/use-api-query';
import { I18nProvider } from '@/i18n/i18n-provider';
import { AssetsPage } from './assets-page';

vi.mock('@/hooks/use-active-scope', () => ({
  useActiveScope: () => ({
    tenantId: 'tenant-1',
    workspaceId: undefined,
    selectTenant: vi.fn(),
    selectWorkspace: vi.fn(),
  }),
}));

vi.mock('@/hooks/use-api-query', () => ({ useApiQuery: vi.fn() }));
vi.mock('@/lib/api', () => ({ apiRequest: vi.fn(), apiVoid: vi.fn(), csrfHeaders: vi.fn(() => ({})) }));

const persona = {
  id: 'persona-1',
  tenantId: 'tenant-1',
  name: 'Persona Alfa',
  description: 'Descrição original',
  status: 'ACTIVE' as const,
  workspaceIds: [],
  workspaces: [],
  activeProjectUsageCount: 0,
};

const context = {
  tenantId: 'tenant-1',
  tenantName: 'Organização Alfa',
  clientRole: 'CLIENT_ADMIN' as const,
  status: 'ACTIVE' as const,
  workspaces: [],
};

function renderPersonas() {
  return render(
    <I18nProvider>
      <AuthContext.Provider value={{
        status: 'authenticated',
        user: { id: 'super-1', name: 'Super', email: 'super@example.com', role: 'SUPER_ADMIN', status: 'ACTIVE', contexts: [context] },
        activeScope: { tenantId: 'tenant-1' },
        activeContext: context,
        effectiveRole: 'SUPER_ADMIN',
        login: vi.fn(),
        logout: vi.fn(),
        refresh: vi.fn(),
        selectScope: vi.fn(),
      }}>
        <AssetsPage kind="personas" />
      </AuthContext.Provider>
    </I18nProvider>,
  );
}

describe('AssetsPage persona editing', () => {
  beforeEach(() => {
    window.localStorage.setItem('personaia.locale', 'pt-BR');
    vi.mocked(useApiQuery).mockReturnValue({ status: 'success', data: [persona], error: null, retry: vi.fn() } as never);
  });

  it('opens the persona edit form in a dialog and closes from cancel', async () => {
    const user = userEvent.setup();
    renderPersonas();

    await user.click(screen.getByRole('button', { name: 'Ações: Persona Alfa' }));
    await user.click(screen.getByRole('menuitem', { name: 'Editar' }));

    const dialog = screen.getByRole('dialog', { name: 'Editar Persona Alfa' });
    expect(dialog).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Nome' })).toHaveValue('Persona Alfa');
    expect(screen.getByRole('textbox', { name: 'Descrição' })).toHaveValue('Descrição original');

    await user.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByRole('dialog', { name: 'Editar Persona Alfa' })).not.toBeInTheDocument();
  });
});
