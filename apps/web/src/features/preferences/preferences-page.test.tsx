import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { I18nProvider } from '@/i18n/i18n-provider';
import { AuthContext } from '@/features/auth/auth-store';
import { apiRequest } from '@/lib/api';
import { cropImageToDataUrl, readAvatarImage } from './avatar-image';
import { PreferencesPage } from './preferences-page';

vi.mock('react-easy-crop', () => ({
  default: ({ onCropComplete }: { onCropComplete?: (area: { x: number; y: number; width: number; height: number }, pixels: { x: number; y: number; width: number; height: number }) => void }) => (
    <button type="button" aria-label="Definir área de recorte" onClick={() => onCropComplete?.(
      { x: 0, y: 0, width: 100, height: 100 },
      { x: 12, y: 18, width: 320, height: 320 },
    )} />
  ),
}));

vi.mock('./avatar-image', () => ({
  AvatarImageError: class AvatarImageError extends Error { constructor(public code: string) { super(code); } },
  readAvatarImage: vi.fn(),
  cropImageToDataUrl: vi.fn(),
}));

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
    vi.mocked(readAvatarImage).mockReset();
    vi.mocked(cropImageToDataUrl).mockReset();
    refresh.mockReset();
    logout.mockReset();
  });

  it('shows language, profile photo, and password controls for the current user', () => {
    renderPage();
    expect(screen.getByRole('heading', { level: 1, name: 'Preferências' })).toBeVisible();
    const sections = screen.getAllByRole('heading', { level: 2 });
    expect(sections.map((heading) => heading.textContent)).toEqual(['Idioma do sistema', 'Foto de perfil', 'Alterar senha']);
    const preferencesContainer = sections[0].closest('section')?.parentElement;
    expect(preferencesContainer).toHaveClass('flex', 'w-full', 'flex-col');
    expect(preferencesContainer).not.toHaveClass('max-w-3xl');
    expect(sections[0].closest('section')).toHaveClass('w-full');
    expect(sections[1].closest('section')).toHaveClass('w-full');
    expect(sections[2].closest('section')).toHaveClass('w-full');
    expect(screen.getByRole('button', { name: 'Idioma' })).toHaveTextContent('Português (BR)');
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

  it('opens a crop editor with zoom and only uploads the cropped image after confirmation', async () => {
    const user = userEvent.setup();
    vi.mocked(readAvatarImage).mockResolvedValue('data:image/png;base64,selected');
    vi.mocked(cropImageToDataUrl).mockResolvedValue('data:image/jpeg;base64,cropped');
    vi.mocked(apiRequest).mockResolvedValue({ hasAvatar: true, avatarUpdatedAt: '2026-08-16T12:00:00.000Z' });
    refresh.mockResolvedValue(undefined);
    renderPage();

    await user.upload(screen.getByLabelText('Escolher foto'), new File(['image'], 'avatar.png', { type: 'image/png' }));

    expect(screen.getByRole('dialog')).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Ajustar foto' })).toBeVisible();
    expect(screen.getByRole('slider', { name: 'Zoom' })).toHaveValue('1');
    expect(apiRequest).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Definir área de recorte' }));
    await user.click(screen.getByRole('button', { name: 'Salvar foto' }));

    await waitFor(() => expect(apiRequest).toHaveBeenCalledWith('/preferences/avatar', expect.anything(), expect.objectContaining({
      method: 'PUT',
      body: { image: 'data:image/jpeg;base64,cropped' },
    })));
    expect(cropImageToDataUrl).toHaveBeenCalledWith('data:image/png;base64,selected', { x: 12, y: 18, width: 320, height: 320 });
    expect(refresh).toHaveBeenCalled();
  });

  it('blocks mismatched password confirmation on the client', async () => {
    const user = userEvent.setup();
    renderPage();
    expect(screen.queryByLabelText('Senha atual')).not.toBeInTheDocument();
    await user.type(screen.getByLabelText('Nova senha'), 'NovaSenha#Segura2027');
    await user.type(screen.getByLabelText('Confirmar nova senha'), 'OutraSenha#Segura2027');
    await user.click(screen.getByRole('button', { name: 'Alterar senha' }));
    await waitFor(() => expect(screen.getByText('As novas senhas não coincidem.')).toBeVisible());
    expect(apiRequest).not.toHaveBeenCalled();
  });

  it('shows every password requirement and submits only the new password', async () => {
    const user = userEvent.setup();
    vi.mocked(apiRequest).mockResolvedValue({ success: true, requiresLogin: true });
    logout.mockResolvedValue(undefined);
    renderPage();

    expect(screen.getByText('No mínimo 12 caracteres')).toBeVisible();
    expect(screen.getByText('Uma letra maiúscula')).toBeVisible();
    expect(screen.getByText('Uma letra minúscula')).toBeVisible();
    expect(screen.getByText('Um número')).toBeVisible();
    expect(screen.getByText('Um caractere especial')).toBeVisible();

    await user.type(screen.getByLabelText('Nova senha'), 'NovaSenha#Segura2027');
    await user.type(screen.getByLabelText('Confirmar nova senha'), 'NovaSenha#Segura2027');
    await user.click(screen.getByRole('button', { name: 'Alterar senha' }));

    await waitFor(() => expect(apiRequest).toHaveBeenCalledWith('/preferences/password', expect.anything(), expect.objectContaining({
      method: 'PATCH',
      body: { newPassword: 'NovaSenha#Segura2027' },
    })));
    expect(logout).toHaveBeenCalled();
  });
});
