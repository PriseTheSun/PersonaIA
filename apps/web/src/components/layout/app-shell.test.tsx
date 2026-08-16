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

function jsonResponse(payload: unknown) {
  return new Response(JSON.stringify(payload), { status: 200, headers: { 'Content-Type': 'application/json' } });
}

describe('AppShell', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('personaia.locale', 'pt-BR');
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => Promise.resolve(jsonResponse({ items: [], unreadCount: 0 }))));
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

    expect(screen.getByRole('button', { name: 'Conta' }).closest('[data-sidebar="sidebar"]')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Idioma' }).closest('header')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Tema' }).closest('header')).not.toBeNull();
  });

  it('shows the user classification as badges without the global platform label', () => {
    renderShell();

    expect(screen.queryByText('Visão global da plataforma')).not.toBeInTheDocument();
    const classifications = screen.getAllByText('Superadministrador');
    expect(classifications).toHaveLength(2);
    expect(classifications.every((classification) => classification.closest('[data-slot="badge"]'))).toBe(true);
  });

  it('keeps sidebar icons and labels on one line', () => {
    renderShell();
    const accessLink = screen.getByRole('link', { name: 'Controle de acessos' });
    const overviewLink = screen.getByRole('link', { name: 'Visão geral' });

    expect(accessLink).toHaveClass('flex', 'w-full', 'overflow-hidden');
    expect(accessLink).toHaveAttribute('data-sidebar', 'menu-button');
    expect(accessLink.className).not.toContain('({ isActive })');
    expect(within(accessLink).getByText('Controle de acessos')).toBeVisible();
    expect(overviewLink).toHaveAttribute('data-active', 'true');
    expect(overviewLink).toHaveClass('data-[active=true]:bg-sidebar-primary', 'data-[active=true]:text-sidebar-primary-foreground');
  });

  it('opens the notification panel with an accessible empty state', async () => {
    const user = userEvent.setup();
    renderShell();

    await user.click(screen.getByRole('button', { name: 'Notificações' }));

    expect(await screen.findByRole('status')).toHaveTextContent('Tudo em dia');
    expect(screen.getByRole('status')).toHaveTextContent('Novas atividades importantes aparecerão aqui.');
  });

  it('shows a persistent unread access request for the responsible client', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => Promise.resolve(jsonResponse({
      unreadCount: 1,
      items: [{
        id: '10000000-0000-4000-8000-000000000001',
        tenantId: '20000000-0000-4000-8000-000000000002',
        type: 'ACCESS_REQUESTED',
        targetId: '30000000-0000-4000-8000-000000000003',
        payload: { userName: 'Pessoa Teste', userEmail: 'pessoa@teste.dev', tenantName: 'Cliente Teste' },
        readAt: null,
        resolvedAt: null,
        createdAt: '2026-08-15T12:00:00.000Z',
      }],
    }))));
    const user = userEvent.setup();
    renderShell();

    await user.click(await screen.findByRole('button', { name: 'Notificações, 1 não lidas' }));

    expect(await screen.findByText('Novo pedido de acesso')).toBeVisible();
    expect(screen.getByText('Pessoa Teste (pessoa@teste.dev) solicitou acesso a Cliente Teste.')).toBeVisible();
  });

  it('opens the complete sidebar as an off-canvas menu on mobile', async () => {
    vi.mocked(window.matchMedia).mockImplementation((query: string) => ({
      matches: query === '(max-width: 767px)',
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

    await user.click(screen.getByRole('button', { name: 'Abrir menu' }));
    const mobileSidebar = screen.getByRole('dialog');

    expect(within(mobileSidebar).getByText('Plataforma')).toBeVisible();
    expect(within(mobileSidebar).getByRole('button', { name: 'Conta' })).toBeVisible();

    await user.click(within(mobileSidebar).getByRole('link', { name: 'Visão geral' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('collapses to icons on desktop, persists the state, and supports Ctrl+B', async () => {
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
    const user = userEvent.setup();
    renderShell();
    const sidebar = document.querySelector('[data-state="expanded"][data-collapsible]');
    const header = document.querySelector('header');

    expect(sidebar).toHaveAttribute('data-state', 'expanded');
    await user.click(within(header as HTMLElement).getByRole('button', { name: 'Abrir menu' }));
    expect(sidebar).toHaveAttribute('data-state', 'collapsed');
    await waitFor(() => expect(localStorage.getItem('personaia.sidebar.open.v1')).toBe('false'));

    await user.hover(within(sidebar as HTMLElement).getByRole('link', { name: 'Visão geral' }));
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Visão geral');

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'b', ctrlKey: true }));
    await waitFor(() => expect(sidebar).toHaveAttribute('data-state', 'expanded'));
  });
});
