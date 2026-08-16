import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { I18nProvider } from '@/i18n/i18n-provider';
import { AuthContext } from '@/features/auth/auth-store';
import { apiRequest } from '@/lib/api';
import { PreferencesPage } from './preferences-page';

vi.mock('@/lib/api', () => ({
  ApiError: class ApiError extends Error { constructor(public status: number, public code: string, message: string) { super(message); } },
  apiRequest: vi.fn(),
  apiVoid: vi.fn(),
  apiBlob: vi.fn(),
  csrfHeaders: vi.fn(() => ({})),
}));

const refresh = vi.fn();
const logout = vi.fn();

function renderPage() {
  return render(
    <I18nProvider>
      <AuthContext.Provider value={{
        status: 'authenticated',
        user: { id: 'user-1', name: 'Admin PersonaIA', email: 'admin@personaia.test', role: 'SUPER_ADMIN', status: 'ACTIVE', hasAvatar: false },
        login: vi.fn(), logout, refresh,
      }}>
        <MemoryRouter><PreferencesPage /></MemoryRouter>
      </AuthContext.Provider>
    </I18nProvider>,
  );
}

describe('PreferencesPage', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('personaia.locale', 'pt-BR');
    vi.mocked(apiRequest).mockReset();
    refresh.mockReset();
    logout.mockReset();
  });

  it('shows profile photo and password controls for the current user', () => {
    renderPage();
    expect(screen.getByRole('heading', { level: 1, name: 'Preferências' })).toBeVisible();
    const sections = screen.getAllByRole('heading', { level: 2 });
    expect(sections.map((heading) => heading.textContent)).toEqual(['Foto de perfil', 'Alterar senha']);
    expect(sections[0].closest('section')?.parentElement).toHaveClass('flex', 'flex-col');
    expect(screen.getByLabelText('Escolher foto')).toHaveAttribute('accept', 'image/png,image/jpeg');
  });

  it('rejects unsupported image types before calling the API', async () => {
    const user = userEvent.setup({ applyAccept: false });
    renderPage();
    await user.upload(screen.getByLabelText('Escolher foto'), new File(['<svg/>'], 'avatar.svg', { type: 'image/svg+xml' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Use uma imagem PNG ou JPEG.');
    expect(apiRequest).not.toHaveBeenCalled();
  });

  it('rejects images larger than 5 MB before calling the API', async () => {
    const user = userEvent.setup();
    renderPage();
    const oversizedImage = new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'avatar.png', { type: 'image/png' });

    await user.upload(screen.getByLabelText('Escolher foto'), oversizedImage);

    expect(await screen.findByRole('alert')).toHaveTextContent('A imagem deve ter no máximo 5 MB.');
    expect(apiRequest).not.toHaveBeenCalled();
  });

  it('blocks mismatched password confirmation on the client', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.type(screen.getByLabelText('Senha atual'), 'SenhaAtual#2026');
    await user.type(screen.getByLabelText('Nova senha'), 'NovaSenha#Segura2027');
    await user.type(screen.getByLabelText('Confirmar nova senha'), 'OutraSenha#Segura2027');
    await user.click(screen.getByRole('button', { name: 'Alterar senha' }));
    await waitFor(() => expect(screen.getByText('As novas senhas não coincidem.')).toBeVisible());
    expect(apiRequest).not.toHaveBeenCalled();
  });
});
