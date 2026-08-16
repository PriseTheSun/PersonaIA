import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { Button } from '@/components/ui/button';
import { I18nProvider } from '@/i18n/i18n-provider';
import { CreationDialog } from './creation-dialog';

function DialogFixture() {
  const [open, setOpen] = useState(false);
  return (
    <CreationDialog
      open={open}
      onOpenChange={setOpen}
      title="Criar projeto"
      description="Preencha os dados do novo projeto."
      trigger={<Button>Novo projeto</Button>}
    >
      <label htmlFor="project-name">Nome</label>
      <input id="project-name" />
    </CreationDialog>
  );
}

function renderDialog() {
  return render(<I18nProvider><DialogFixture /></I18nProvider>);
}

describe('CreationDialog', () => {
  it('opens from its trigger and exposes the form as an accessible dialog', async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.click(screen.getByRole('button', { name: 'Novo projeto' }));

    expect(screen.getByRole('dialog', { name: 'Criar projeto' })).toBeInTheDocument();
    expect(screen.getByText('Preencha os dados do novo projeto.')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Nome' })).toBeInTheDocument();
  });

  it('closes with Escape and restores focus to the creation trigger', async () => {
    const user = userEvent.setup();
    renderDialog();
    const trigger = screen.getByRole('button', { name: 'Novo projeto' });

    await user.click(trigger);
    await user.keyboard('{Escape}');

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });
});
