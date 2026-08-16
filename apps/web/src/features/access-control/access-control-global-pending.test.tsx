import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { AuthContext } from '@/features/auth/auth-store';
import { I18nProvider } from '@/i18n/i18n-provider';
import { apiRequest } from '@/lib/api';
import { AccessControlPage } from './access-control-page';

vi.mock('@/lib/api', () => ({
  ApiError: class ApiError extends Error {},
  apiRequest: vi.fn(),
  csrfHeaders: vi.fn(() => ({ 'X-CSRF-Token': 'test' })),
}));

describe('AccessControlPage global pending registrations', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('personaia.locale', 'pt-BR');
    vi.mocked(apiRequest).mockImplementation((path) => {
      if (path === '/user-access') return Promise.resolve([
        {
          id: 'pending-user', name: 'Cadastro Pendente', email: 'pendente@teste.dev',
          role: 'PROJECT_USER', status: 'PENDING_APPROVAL', membershipCount: 0,
          clientMemberships: [], createdAt: '2026-08-16T02:00:00.000Z',
        },
        {
          id: 'active-user', name: 'Cadastro Ativo', email: 'ativo@teste.dev',
          role: 'PROJECT_USER', status: 'ACTIVE', membershipCount: 1,
          clientMemberships: [], createdAt: '2026-08-15T02:00:00.000Z',
        },
      ]) as never;
      if (path === '/tenants') return Promise.resolve([]) as never;
      return Promise.resolve([]) as never;
    });
  });

  it('opens the platform pending filter by default for a Super Admin', async () => {
    const user = userEvent.setup();
    render(
      <I18nProvider>
        <AuthContext.Provider value={{
          status: 'authenticated',
          user: { id: 'super-1', name: 'Super Admin', email: 'super@teste.dev', role: 'SUPER_ADMIN', status: 'ACTIVE' },
          login: vi.fn(), logout: vi.fn(), refresh: vi.fn(), selectScope: vi.fn(),
        }}>
          <MemoryRouter initialEntries={['/access-control']}><AccessControlPage /></MemoryRouter>
        </AuthContext.Provider>
      </I18nProvider>,
    );

    expect(screen.getByRole('button', { name: 'Identidades da plataforma' })).toHaveAttribute('aria-pressed', 'true');
    expect((await screen.findAllByText('Cadastro Pendente')).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Aguardando aprovação').length).toBeGreaterThan(0);
    expect(screen.queryByText('Cadastro Ativo')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Pendentes 1' })).toHaveAttribute('aria-pressed', 'true');
    await waitFor(() => expect(apiRequest).toHaveBeenCalledWith('/user-access', expect.anything(), expect.anything()));

    await user.click(screen.getByRole('button', { name: 'Todos 2' }));
    expect((await screen.findAllByText('Cadastro Ativo')).length).toBeGreaterThan(0);
  });
});
