import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { I18nProvider } from '@/i18n/i18n-provider';
import { AuthContext } from './auth-store';
import { LoginPage } from './login-page';

const login = vi.fn();

function renderLogin() {
  return render(
    <I18nProvider>
      <MemoryRouter>
        <AuthContext.Provider value={{ status: 'anonymous', user: null, login, logout: vi.fn(), refresh: vi.fn() }}>
          <LoginPage />
        </AuthContext.Provider>
      </MemoryRouter>
    </I18nProvider>,
  );
}

describe('LoginPage', () => {
  beforeEach(() => {
    login.mockReset();
    localStorage.clear();
    localStorage.setItem('personaia.locale', 'pt-BR');
  });

  it('shows and hides the password without changing its value', async () => {
    const user = userEvent.setup();
    renderLogin();
    const password = screen.getByLabelText('Senha');

    await user.type(password, 'MinhaSenha!2026');
    expect(password).toHaveAttribute('type', 'password');
    await user.click(screen.getByRole('button', { name: 'Mostrar senha' }));
    expect(password).toHaveAttribute('type', 'text');
    expect(password).toHaveValue('MinhaSenha!2026');
    await user.click(screen.getByRole('button', { name: 'Ocultar senha' }));
    expect(password).toHaveAttribute('type', 'password');
  });

  it('submits the remember-me preference without storing the password', async () => {
    const user = userEvent.setup();
    login.mockRejectedValue(new Error('stop navigation'));
    renderLogin();

    await user.type(screen.getByLabelText('E-mail'), 'admin@personaia.test');
    await user.type(screen.getByLabelText('Senha'), 'MinhaSenha!2026');
    await user.click(screen.getByRole('checkbox', { name: 'Lembrar-me neste dispositivo' }));
    await user.click(screen.getByRole('button', { name: 'Entrar' }));

    await waitFor(() => expect(login).toHaveBeenCalledWith({
      email: 'admin@personaia.test',
      password: 'MinhaSenha!2026',
      rememberMe: true,
    }));
    expect(localStorage.getItem('password')).toBeNull();
    expect(sessionStorage.getItem('password')).toBeNull();
  });

  it('allows navigating and pausing the authentication carousel', async () => {
    const user = userEvent.setup();
    renderLogin();
    const carousel = screen.getByRole('complementary', { name: 'Recursos da PersonaIA' });

    expect(within(carousel).getByText('Entenda o que as pessoas realmente dizem')).toBeInTheDocument();
    await user.click(within(carousel).getByRole('button', { name: /Ver slide 2:/ }));
    expect(within(carousel).getByText('Crie personas consistentes em minutos')).toBeInTheDocument();
    await user.click(within(carousel).getByRole('button', { name: 'Pausar apresentação' }));
    expect(within(carousel).getByRole('button', { name: 'Continuar apresentação' })).toBeInTheDocument();
  });
});
