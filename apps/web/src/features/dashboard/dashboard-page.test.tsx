import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { I18nProvider } from '@/i18n/i18n-provider';
import { apiRequest } from '@/lib/api';
import type { Role } from '@/lib/schemas';
import { AuthContext } from '@/features/auth/auth-store';
import { DashboardPage } from './dashboard-page';

vi.mock('@/lib/api', () => ({ apiRequest: vi.fn() }));

const apiRequestMock = vi.mocked(apiRequest);

function response(range: '7d' | '30d' | '12m' | '5y' = '30d', scope: 'PLATFORM' | 'TENANT' | 'WORKSPACE' = 'PLATFORM') {
  return {
    scope,
    range,
    bucket: range.endsWith('d') ? 'day' : range.endsWith('m') ? 'month' : 'year',
    from: '2026-07-17T00:00:00.000Z',
    to: '2026-08-15T12:00:00.000Z',
    metrics: {
      projectsCreated: 4,
      personasCreated: 9,
      activeUsers: 23,
      pendingAccessRequests: 3,
    },
    series: [
      { periodStart: '2026-08-14T00:00:00.000Z', projectsCreated: 1, personasCreated: 3 },
      { periodStart: '2026-08-15T00:00:00.000Z', projectsCreated: 3, personasCreated: 6 },
    ],
    recentActivity: [],
  } as const;
}

function renderDashboard(role: Role = 'SUPER_ADMIN') {
  const isMember = role === 'WORKSPACE_MEMBER' || role === 'PROJECT_USER';
  return render(
    <I18nProvider>
      <MemoryRouter>
        <AuthContext.Provider value={{
          status: 'authenticated',
          user: { id: 'user-1', name: 'Admin', email: 'admin@personaia.test', role, status: 'ACTIVE' },
          ...(isMember ? {
            activeScope: { tenantId: 'tenant-1', workspaceId: 'workspace-1' },
            activeContext: { tenantId: 'tenant-1', tenantName: 'Client', status: 'ACTIVE' as const, workspaces: [{ id: 'workspace-1', name: 'Research', role: 'WORKSPACE_MEMBER' as const, status: 'ACTIVE' as const, permissions: [{ feature: 'DASHBOARD' as const, level: 'READ' as const, effect: 'ALLOW' as const }] }] },
            effectiveRole: 'WORKSPACE_MEMBER' as const,
          } : {}),
          login: vi.fn(), logout: vi.fn(), refresh: vi.fn(),
        }}>
          <DashboardPage />
        </AuthContext.Provider>
      </MemoryRouter>
    </I18nProvider>,
  );
}

describe('DashboardPage', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('personaia.locale', 'pt-BR');
    apiRequestMock.mockReset();
    apiRequestMock.mockImplementation((path) => {
      if (path === '/tenants') return Promise.resolve([]) as never;
      const range = path.includes('12m') ? '12m' : path.includes('7d') ? '7d' : path.includes('5y') ? '5y' : '30d';
      return Promise.resolve(response(range)) as never;
    });
  });

  it('shows the requested platform indicators and reloads the selected period', async () => {
    const user = userEvent.setup();
    renderDashboard();

    const indicators = await screen.findByRole('region', { name: 'Indicadores principais' });
    expect(within(indicators).getByText('Projetos criados')).toBeInTheDocument();
    expect(within(indicators).getByText('Personas criadas')).toBeInTheDocument();
    expect(within(indicators).getByText('Usuários ativos')).toBeInTheDocument();
    expect(within(indicators).getByText('Pedidos aguardando aprovação')).toBeInTheDocument();
    expect(screen.getByText('Dados detalhados da evolução de projetos e personas.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '12 meses' }));
    await waitFor(() => expect(apiRequestMock).toHaveBeenCalledWith(
      '/dashboard/summary?range=12m',
      expect.anything(),
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    ));
    expect(screen.getByRole('button', { name: '12 meses' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('shows workspace analytics without client approval controls to a member with DASHBOARD READ', async () => {
    apiRequestMock.mockResolvedValue(response('30d', 'WORKSPACE') as never);
    renderDashboard('WORKSPACE_MEMBER');

    const indicators = await screen.findByRole('region', { name: 'Indicadores principais' });
    expect(within(indicators).getByText('Projetos criados')).toBeInTheDocument();
    expect(within(indicators).getByText('Personas criadas')).toBeInTheDocument();
    expect(within(indicators).getByText('Usuários ativos')).toBeInTheDocument();
    expect(within(indicators).queryByText('Pedidos aguardando aprovação')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Evolução das criações' })).toBeInTheDocument();
    expect(screen.queryByText('Revisar solicitações de acesso')).not.toBeInTheDocument();
  });
});
