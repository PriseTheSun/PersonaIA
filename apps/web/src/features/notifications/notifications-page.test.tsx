import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { I18nProvider } from '@/i18n/i18n-provider';
import { useApiQuery } from '@/hooks/use-api-query';
import { apiVoid } from '@/lib/api';
import { NotificationsPage } from './notifications-page';

const retry = vi.fn();
const response = {
  items: [{
    id: '10000000-0000-4000-8000-000000000001',
    tenantId: '20000000-0000-4000-8000-000000000002',
    type: 'ACCESS_REQUESTED',
    targetId: '30000000-0000-4000-8000-000000000003',
    payload: { userName: 'Pessoa Teste', userEmail: 'pessoa@teste.dev', tenantName: 'Organização Teste' },
    readAt: null,
    resolvedAt: null,
    createdAt: '2026-08-15T12:00:00.000Z',
  }],
  unreadCount: 1,
  pagination: { page: 1, pageSize: 20, total: 21, totalPages: 2 },
};

vi.mock('@/hooks/use-api-query', () => ({ useApiQuery: vi.fn() }));
vi.mock('@/lib/api', () => ({
  apiRequest: vi.fn(),
  apiVoid: vi.fn(),
  csrfHeaders: vi.fn(() => ({ 'X-CSRF-Token': 'test' })),
}));

function CurrentLocation() {
  return <output data-testid="location">{useLocation().pathname}{useLocation().search}</output>;
}

function renderPage() {
  return render(
    <I18nProvider>
      <MemoryRouter initialEntries={['/notifications?status=ALL&page=1']}>
        <CurrentLocation />
        <Routes>
          <Route path="/notifications" element={<NotificationsPage />} />
          <Route path="/access-control" element={<div>Controle de acessos</div>} />
        </Routes>
      </MemoryRouter>
    </I18nProvider>,
  );
}

describe('NotificationsPage', () => {
  beforeEach(() => {
    localStorage.setItem('personaia.locale', 'pt-BR');
    retry.mockClear();
    vi.mocked(apiVoid).mockReset().mockResolvedValue(undefined);
    vi.mocked(useApiQuery).mockReturnValue({ status: 'success', data: response, error: null, retry } as never);
  });

  it('lists the user notifications and opens the related access request', async () => {
    const user = userEvent.setup();
    renderPage();

    expect(screen.getByRole('heading', { level: 1, name: 'Notificações' })).toBeInTheDocument();
    expect(screen.getByText('Pessoa Teste (pessoa@teste.dev) solicitou acesso a Organização Teste.')).toBeVisible();
    expect(screen.getByText('21 notificações encontradas')).toBeVisible();

    await user.click(screen.getByRole('button', { name: /Novo pedido de acesso/ }));

    await waitFor(() => expect(apiVoid).toHaveBeenCalledWith(
      '/notifications/10000000-0000-4000-8000-000000000001/read',
      expect.objectContaining({ method: 'PATCH' }),
    ));
    expect(screen.getByTestId('location')).toHaveTextContent('/access-control?status=PENDING&view=CLIENT&tenant=20000000-0000-4000-8000-000000000002');
  });

  it('keeps filters and pagination in the URL and marks all notifications as read', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: 'Não lidas 1' }));
    expect(screen.getByTestId('location')).toHaveTextContent('/notifications?status=UNREAD&page=1');

    await user.click(screen.getByRole('button', { name: 'Próxima' }));
    expect(screen.getByTestId('location')).toHaveTextContent('/notifications?status=UNREAD&page=2');

    await user.click(screen.getByRole('button', { name: 'Marcar todas como lidas' }));
    await waitFor(() => expect(apiVoid).toHaveBeenCalledWith('/notifications/read-all', expect.objectContaining({ method: 'PATCH' })));
    expect(retry).toHaveBeenCalled();
  });
});
