import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '@/i18n/i18n-provider';
import { LanguageSelector } from './language-selector';

const toastSuccess = vi.hoisted(() => vi.fn());
const toastError = vi.hoisted(() => vi.fn());

vi.mock('sonner', () => ({ toast: { success: toastSuccess, error: toastError } }));

describe('LanguageSelector', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('personaia.locale', 'pt-BR');
    toastSuccess.mockReset();
    toastError.mockReset();
  });

  it('notifies the language change in the newly selected language', async () => {
    const user = userEvent.setup();
    render(<I18nProvider><LanguageSelector showLabel /></I18nProvider>);

    await user.click(screen.getByRole('button', { name: 'Idioma' }));
    await user.click(await screen.findByRole('menuitemradio', { name: 'Español' }));

    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith('Idioma cambiado a Español.'));
    expect(screen.getByRole('button', { name: 'Idioma' })).toHaveTextContent('Español');
    expect(localStorage.getItem('personaia.locale')).toBe('es');
    expect(toastError).not.toHaveBeenCalled();
  });
});
