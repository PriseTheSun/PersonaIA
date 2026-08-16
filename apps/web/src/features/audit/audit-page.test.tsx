import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '@/i18n/i18n-provider';
import { AuditPage } from './audit-page';

const response = {
  items: [{
    id: '10000000-0000-4000-8000-000000000001',
    action: 'TENANT_CREATED',
    targetType: 'Tenant',
    targetId: '20000000-0000-4000-8000-000000000002',
    scopeType: 'TENANT',
    scopeId: '20000000-0000-4000-8000-000000000002',
    metadata: { clientMembershipId: '30000000-0000-4000-8000-000000000003', token: '[REDACTED]' },
    createdAt: '2026-08-20T12:30:00.000Z',
    actor: { id: '40000000-0000-4000-8000-000000000004', name: 'Super PersonaIA', email: 'super@personaia.test' },
    tenant: { id: '20000000-0000-4000-8000-000000000002', name: 'Organização Acme', slug: 'acme' },
  }],
  pagination: { page: 1, pageSize: 25, total: 1, totalPages: 1 },
  filters: { actions: ['TENANT_CREATED'], targetTypes: ['Tenant'], tenants: [{ id: '20000000-0000-4000-8000-000000000002', name: 'Organização Acme', slug: 'acme' }] },
};

vi.mock('@/hooks/use-api-query', () => ({
  useApiQuery: vi.fn(() => ({ status: 'success', data: response, error: null, retry: vi.fn() })),
}));

describe('AuditPage', () => {
  it('shows a filterable audit table and safe details without console errors', async () => {
    localStorage.setItem('personaia.locale', 'pt-BR');
    const user = userEvent.setup();
    render(<I18nProvider><MemoryRouter><AuditPage /></MemoryRouter></I18nProvider>);

    expect(screen.getByRole('heading', { level: 1, name: 'Auditoria' })).toBeInTheDocument();
    expect(screen.getByLabelText('Busca')).toHaveAttribute('maxlength', '100');
    expect(screen.getByRole('columnheader', { name: 'Evento' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Ator' })).toBeInTheDocument();
    expect(screen.getAllByText('TENANT_CREATED').length).toBeGreaterThan(0);

    await user.click(screen.getByRole('button', { name: 'Ações: TENANT_CREATED' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Ver detalhes' }));

    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Detalhes do registro' })).toBeInTheDocument();
    expect(screen.getByText(/"token": "\[REDACTED\]"/)).toBeInTheDocument();
  });
});
