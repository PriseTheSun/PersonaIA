import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { I18nProvider } from '@/i18n/i18n-provider';
import { AuthContext } from '@/features/auth/auth-store';
import { AppShell } from './app-shell';

function renderShell() {
  return render(
    <I18nProvider>
      <MemoryRouter>
        <AuthContext.Provider value={{
          status: 'authenticated',
          user: { id: 'user-1', name: 'Admin PersonaIA', email: 'admin@personaia.test', role: 'SUPER_ADMIN', status: 'ACTIVE' },
          login: vi.fn(),
          logout: vi.fn(),
          refresh: vi.fn(),
        }}>
          <Routes>
            <Route element={<AppShell />}><Route index element={<div>Dashboard</div>} /></Route>
          </Routes>
        </AuthContext.Provider>
      </MemoryRouter>
    </I18nProvider>,
  );
}

describe('AppShell', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('personaia.locale', 'pt-BR');
  });

  it('places the account avatar in the sidebar and keeps settings in the header', () => {
    renderShell();

    expect(screen.getByRole('button', { name: 'Conta' }).closest('aside')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Idioma' }).closest('header')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Tema' }).closest('header')).not.toBeNull();
  });

  it('opens the notification panel with an accessible empty state', async () => {
    const user = userEvent.setup();
    renderShell();

    await user.click(screen.getByRole('button', { name: 'Notificações' }));

    expect(screen.getByRole('status')).toHaveTextContent('Tudo em dia');
    expect(screen.getByRole('status')).toHaveTextContent('Novas atividades importantes aparecerão aqui.');
  });
});
