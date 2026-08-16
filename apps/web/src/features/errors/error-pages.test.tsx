import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { AuthContext } from '@/features/auth/auth-store';
import { I18nProvider } from '@/i18n/i18n-provider';
import { NotFoundPage } from './error-pages';

function renderNotFound(authenticated: boolean) {
  return render(
    <I18nProvider>
      <AuthContext.Provider value={authenticated ? {
        status: 'authenticated',
        user: { id: 'user-1', name: 'Admin', email: 'admin@example.com', role: 'SUPER_ADMIN', status: 'ACTIVE' },
        login: vi.fn(), logout: vi.fn(), refresh: vi.fn(),
      } : {
        status: 'anonymous', user: null,
        login: vi.fn(), logout: vi.fn(), refresh: vi.fn(),
      }}>
        <MemoryRouter initialEntries={['/endereco/inexistente']}><NotFoundPage /></MemoryRouter>
      </AuthContext.Provider>
    </I18nProvider>,
  );
}

describe('NotFoundPage', () => {
  it('orienta visitantes a retornar ao login', () => {
    window.localStorage.setItem('personaia.locale', 'pt-BR');
    renderNotFound(false);

    expect(screen.getByRole('heading', { name: 'Página não encontrada' })).toBeVisible();
    expect(screen.getByLabelText('Erro 404')).toBeVisible();
    expect(screen.getByText('/endereco/inexistente')).toBeVisible();
    expect(screen.getByRole('link', { name: 'Voltar ao login' })).toHaveAttribute('href', '/login');
    expect(screen.getByRole('button', { name: 'Voltar à página anterior' })).toBeVisible();
  });

  it('orienta usuários autenticados a retornar à visão geral', () => {
    window.localStorage.setItem('personaia.locale', 'pt-BR');
    renderNotFound(true);

    expect(screen.getByRole('link', { name: 'Voltar à visão geral' })).toHaveAttribute('href', '/');
    expect(screen.queryByRole('link', { name: 'Voltar ao login' })).not.toBeInTheDocument();
  });
});
