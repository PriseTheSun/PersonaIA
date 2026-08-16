import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { I18nProvider } from '@/i18n/i18n-provider';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ProjectAccessCode } from './project-access-code';

describe('ProjectAccessCode', () => {
  beforeEach(() => {
    localStorage.setItem('personaia.locale', 'pt-BR');
  });

  it('shows the 12-character code and its automatic renewal countdown', () => {
    render(
      <I18nProvider>
        <TooltipProvider>
          <ProjectAccessCode
            projectId="10000000-0000-4000-8000-000000000001"
            initial={{
              code: 'ABCDEFGHJKLM',
              expiresAt: new Date(Date.now() + 10 * 60_000).toISOString(),
              serverTime: new Date().toISOString(),
            }}
          />
        </TooltipProvider>
      </I18nProvider>,
    );

    expect(screen.getByText('ABCDEFGHJKLM')).toBeVisible();
    expect(screen.getByText(/renova em 10:00|renova em 09:59/)).toBeVisible();
    expect(screen.getByRole('button', { name: 'Copiar código' })).toBeVisible();
  });
});
