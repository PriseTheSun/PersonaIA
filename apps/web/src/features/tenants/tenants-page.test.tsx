import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '@/i18n/i18n-provider';
import { TenantsPage } from './tenants-page';

vi.mock('@/hooks/use-api-query', () => ({
  useApiQuery: vi.fn(() => ({
    status: 'success',
    data: [{
      id: 'tenant-1',
      name: 'Organização Acme',
      slug: 'acme',
      segment: 'Pesquisa',
      status: 'ACTIVE',
      workspaceCount: 2,
      adminCount: 3,
      memberCount: 8,
      projectCount: 5,
      createdAt: '2026-08-15T12:00:00.000Z',
    }],
    error: null,
    retry: vi.fn(),
  })),
}));

vi.mock('@/lib/api', () => ({
  apiRequest: vi.fn(),
  csrfHeaders: vi.fn(() => ({})),
}));

describe('TenantsPage', () => {
  it('separa status e criação e concentra ações no menu de três pontos', async () => {
    window.localStorage.setItem('personaia.locale', 'pt-BR');
    const user = userEvent.setup();
    render(<I18nProvider><MemoryRouter><TenantsPage /></MemoryRouter></I18nProvider>);

    expect(screen.getByRole('columnheader', { name: 'Status' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Criação' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Ações' })).toBeInTheDocument();

    const row = screen.getByRole('row', { name: /Organização Acme/ });
    const cells = within(row).getAllByRole('cell');
    expect(within(cells[4]).getByText('Ativo')).toBeInTheDocument();
    expect(cells[5]).toHaveTextContent('15 de ago. de 2026');
    expect(within(cells[5]).queryByText('Ativo')).not.toBeInTheDocument();

    await user.click(within(row).getByRole('button', { name: 'Ações: Organização Acme' }));
    expect(screen.getByRole('menuitem', { name: 'Gerenciar' })).toHaveAttribute('href', '/workspaces?tenant=tenant-1');
  });

  it('usa um campo multilinha para a descrição da nova organização', async () => {
    window.localStorage.setItem('personaia.locale', 'pt-BR');
    const user = userEvent.setup();
    render(<I18nProvider><MemoryRouter><TenantsPage /></MemoryRouter></I18nProvider>);

    await user.click(screen.getByRole('button', { name: 'Adicionar organização' }));

    const description = screen.getByRole('textbox', { name: 'Descrição' });
    expect(description.tagName).toBe('TEXTAREA');
    expect(description).toHaveAttribute('maxlength', '500');
    expect(description).toHaveAttribute('rows', '4');
  });
});
