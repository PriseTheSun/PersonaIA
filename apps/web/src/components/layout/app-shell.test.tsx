import { render, screen, waitFor, within } from '@testing-library/react';
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
    vi.mocked(window.matchMedia).mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
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

  it('opens the complete sidebar as an off-canvas menu on mobile', async () => {
    const user = userEvent.setup();
    renderShell();

    await user.click(screen.getByRole('button', { name: 'Abrir menu' }));
    const mobileSidebar = screen.getByRole('dialog');

    expect(within(mobileSidebar).getByText('Plataforma')).toBeVisible();
    expect(within(mobileSidebar).getByRole('button', { name: 'Conta' })).toBeVisible();
  });

  it('collapses to icons on desktop, persists the state, and supports Ctrl+B', async () => {
    vi.mocked(window.matchMedia).mockImplementation((query: string) => ({
      matches: query === '(min-width: 1024px)',
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
    const user = userEvent.setup();
    renderShell();
    const sidebar = document.querySelector('aside[data-sidebar="sidebar"]');
    const header = document.querySelector('header');

    expect(sidebar).toHaveAttribute('data-state', 'expanded');
    await user.click(within(header as HTMLElement).getByRole('button', { name: 'Recolher sidebar' }));
    expect(sidebar).toHaveAttribute('data-state', 'collapsed');
    await waitFor(() => expect(localStorage.getItem('personaia.sidebar.open.v1')).toBe('false'));

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'b', ctrlKey: true }));
    await waitFor(() => expect(sidebar).toHaveAttribute('data-state', 'expanded'));
  });
});
