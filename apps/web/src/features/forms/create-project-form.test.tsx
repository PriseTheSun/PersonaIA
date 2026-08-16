import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '@/i18n/i18n-provider';
import { apiRequest } from '@/lib/api';
import { CreateProjectForm } from './create-project-form';
import { ProjectWorkspaceForm } from './project-workspace-form';

vi.mock('@/lib/api', () => ({
  apiRequest: vi.fn(),
  csrfHeaders: vi.fn(() => ({ 'X-CSRF-Token': 'test' })),
}));

describe('CreateProjectForm', () => {
  beforeEach(() => {
    window.localStorage.setItem('personaia.locale', 'pt-BR');
    vi.mocked(apiRequest).mockResolvedValue({});
  });

  it('creates a project in the organization without requiring a workspace', async () => {
    const user = userEvent.setup();
    const tenantId = '10000000-0000-4000-8000-000000000001';
    render(
      <I18nProvider>
        <CreateProjectForm
          tenantId={tenantId}
          workspaces={[]}
          allowWithoutWorkspace
          onCreated={vi.fn()}
          onCancel={vi.fn()}
        />
      </I18nProvider>,
    );

    expect(screen.getByRole('option', { name: 'Sem workspace' })).toBeInTheDocument();
    await user.type(screen.getByRole('textbox', { name: 'Nome' }), 'Pesquisa nacional');
    await user.click(screen.getByRole('button', { name: 'Novo projeto' }));

    await waitFor(() => expect(apiRequest).toHaveBeenCalledWith('/projects', expect.anything(), expect.objectContaining({
      method: 'POST',
      body: { tenantId, name: 'Pesquisa nacional' },
    })));
  });

  it('moves an existing project out of its workspace folder', async () => {
    const user = userEvent.setup();
    const workspaceId = '20000000-0000-4000-8000-000000000002';
    const project = {
      id: '30000000-0000-4000-8000-000000000003',
      name: 'Pesquisa nacional',
      workspaceId,
      workspace: { id: workspaceId, name: 'Pesquisas 2026' },
      status: 'ACTIVE' as const,
      memberCount: 0,
      updatedAt: '2026-08-15T12:00:00.000Z',
    };
    render(
      <I18nProvider>
        <ProjectWorkspaceForm
          project={project}
          workspaces={[{
            id: workspaceId,
            tenantId: '10000000-0000-4000-8000-000000000001',
            name: 'Pesquisas 2026',
            status: 'ACTIVE',
            isDefault: false,
            memberCount: 0,
            projectCount: 1,
            personaCount: 0,
            questionnaireCount: 0,
          }]}
          onSaved={vi.fn()}
          onCancel={vi.fn()}
        />
      </I18nProvider>,
    );

    await user.selectOptions(screen.getByRole('combobox', { name: 'Workspace (opcional)' }), '');
    await user.click(screen.getByRole('button', { name: 'Salvar alterações' }));

    await waitFor(() => expect(apiRequest).toHaveBeenCalledWith(`/projects/${project.id}`, expect.anything(), expect.objectContaining({
      method: 'PATCH',
      body: { workspaceId: null },
    })));
  });
});
