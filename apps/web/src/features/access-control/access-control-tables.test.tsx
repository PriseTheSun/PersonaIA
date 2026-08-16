import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '@/i18n/i18n-provider';
import { platformIdentitySchema } from '@/lib/schemas';
import { PlatformAccessTable } from './access-control-tables';

describe('PlatformAccessTable', () => {
  it('uses a table and keeps identity editing inside the ellipse menu', async () => {
    localStorage.setItem('personaia.locale', 'pt-BR');
    const onEdit = vi.fn();
    const identity = platformIdentitySchema.parse({
      id: 'identity-1',
      name: 'Pessoa Global',
      email: 'global@teste.dev',
      role: 'PROJECT_USER',
      status: 'ACTIVE',
      membershipCount: 2,
      clientMemberships: [],
      createdAt: '2026-08-15T20:00:00.000Z',
    });
    const user = userEvent.setup();

    render(
      <I18nProvider>
        <PlatformAccessTable
          items={[identity]}
          status="success"
          currentUserId="another-user"
          mutatingId={null}
          onRetry={vi.fn()}
          onEdit={onEdit}
        />
      </I18nProvider>,
    );

    expect(screen.getByRole('columnheader', { name: 'Identidade' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Perfil global' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Alterar acesso: Pessoa Global' })).not.toBeInTheDocument();

    await user.click(screen.getAllByRole('button', { name: 'Ações: Pessoa Global' })[0]);
    await user.click(await screen.findByRole('menuitem', { name: 'Alterar acesso' }));

    expect(onEdit).toHaveBeenCalledWith(identity.id);
  });
});
