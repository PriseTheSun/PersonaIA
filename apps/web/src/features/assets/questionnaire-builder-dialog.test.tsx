import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useApiQuery } from '@/hooks/use-api-query';
import { I18nProvider } from '@/i18n/i18n-provider';
import { apiRequest } from '@/lib/api';
import { QuestionnaireBuilderDialog } from './questionnaire-builder-dialog';

vi.mock('@/hooks/use-api-query', () => ({ useApiQuery: vi.fn() }));
vi.mock('@/lib/api', () => ({ apiRequest: vi.fn(), apiVoid: vi.fn(), csrfHeaders: vi.fn(() => ({ 'X-CSRF-Token': 'test' })) }));

const questionnaire = {
  id: '30000000-0000-4000-8000-000000000003',
  tenantId: '10000000-0000-4000-8000-000000000001',
  name: 'Pesquisa de hábitos',
  description: null,
  status: 'ACTIVE' as const,
  workspaceIds: [],
  workspaces: [],
  activeProjectUsageCount: 0,
  questionCount: 0,
};

function renderBuilder() {
  return render(
    <I18nProvider>
      <QuestionnaireBuilderDialog
        open
        onOpenChange={vi.fn()}
        tenantId={questionnaire.tenantId}
        questionnaire={questionnaire}
        canWrite
        onChanged={vi.fn()}
      />
    </I18nProvider>,
  );
}

describe('QuestionnaireBuilderDialog', () => {
  beforeEach(() => {
    window.localStorage.setItem('personaia.locale', 'pt-BR');
    vi.mocked(useApiQuery).mockReturnValue({ status: 'success', data: [], error: null, retry: vi.fn() } as never);
    vi.mocked(apiRequest).mockResolvedValue({
      id: '40000000-0000-4000-8000-000000000004',
      tenantId: questionnaire.tenantId,
      questionnaireId: questionnaire.id,
      prompt: 'Qual canal você mais utiliza?',
      type: 'MULTIPLE_CHOICE',
      position: 0,
      options: [
        { id: '50000000-0000-4000-8000-000000000005', label: 'Aplicativo', position: 0 },
        { id: '60000000-0000-4000-8000-000000000006', label: 'Site', position: 1 },
      ],
    });
  });

  it('creates a multiple-choice question with validated alternatives', async () => {
    const user = userEvent.setup();
    renderBuilder();

    await user.click(screen.getByRole('button', { name: 'Nova pergunta' }));
    await user.type(screen.getByRole('textbox', { name: 'Pergunta' }), 'Qual canal você mais utiliza?');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Tipo de pergunta' }), 'MULTIPLE_CHOICE');
    await user.type(screen.getByRole('textbox', { name: 'Alternativa 1' }), 'Aplicativo');
    await user.type(screen.getByRole('textbox', { name: 'Alternativa 2' }), 'Site');
    await user.click(screen.getByRole('button', { name: 'Salvar pergunta' }));

    await waitFor(() => expect(apiRequest).toHaveBeenCalledWith(
      `/tenants/${questionnaire.tenantId}/questionnaires/${questionnaire.id}/questions`,
      expect.anything(),
      expect.objectContaining({
        method: 'POST',
        body: {
          prompt: 'Qual canal você mais utiliza?',
          type: 'MULTIPLE_CHOICE',
          options: ['Aplicativo', 'Site'],
        },
      }),
    ));
  });
});
