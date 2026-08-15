import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { I18nProvider } from '@/i18n/i18n-provider';
import { AuthContext } from './auth-store';
import { RegisterPage } from './register-page';

function renderRegister() {
  return render(
    <I18nProvider>
      <MemoryRouter>
        <AuthContext.Provider value={{ status: 'anonymous', user: null, login: vi.fn(), logout: vi.fn(), refresh: vi.fn() }}>
          <RegisterPage />
        </AuthContext.Provider>
      </MemoryRouter>
    </I18nProvider>,
  );
}

describe('RegisterPage', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('personaia.locale', 'pt-BR');
  });

  it('uses the shared authentication layout and toggles each password independently', async () => {
    const user = userEvent.setup();
    renderRegister();

    expect(screen.getByRole('complementary')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Idioma' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tema' })).toBeInTheDocument();

    const password = screen.getByLabelText('Senha');
    const confirmation = screen.getByLabelText('Confirmar senha');
    await user.type(password, 'MinhaSenha!2026');
    await user.type(confirmation, 'MinhaSenha!2026');

    const visibilityButtons = screen.getAllByRole('button', { name: 'Mostrar senha' });
    expect(visibilityButtons).toHaveLength(2);
    await user.click(visibilityButtons[0]);

    expect(password).toHaveAttribute('type', 'text');
    expect(password).toHaveValue('MinhaSenha!2026');
    expect(confirmation).toHaveAttribute('type', 'password');
  });
});
