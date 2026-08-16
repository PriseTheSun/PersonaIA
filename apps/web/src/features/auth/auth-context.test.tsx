import { act, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider } from './auth-context';
import { useAuth } from './auth-store';

const apiMocks = vi.hoisted(() => ({
  apiRequest: vi.fn(),
  apiVoid: vi.fn(),
  restoreAccessToken: vi.fn(),
  setAccessToken: vi.fn(),
  setScopeContext: vi.fn(),
  setUnauthorizedHandler: vi.fn(),
}));

vi.mock('@/lib/api', () => ({
  ...apiMocks,
  csrfHeaders: vi.fn(() => ({})),
  getCsrfToken: vi.fn(() => 'csrf-token'),
}));

function AuthStatus() {
  return <span>{useAuth().status}</span>;
}

describe('AuthProvider session lifetime', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date('2026-08-15T20:00:00.000Z'));
    Object.values(apiMocks).forEach((mock) => mock.mockReset());
    apiMocks.restoreAccessToken.mockResolvedValue({
      accessToken: 'restored-token',
      sessionExpiresAt: '2026-08-15T22:00:00.000Z',
    });
    apiMocks.apiRequest.mockResolvedValue({
      id: 'user-1', name: 'Admin', email: 'admin@personaia.test', role: 'SUPER_ADMIN', status: 'ACTIVE', contexts: [],
    });
    apiMocks.apiVoid.mockResolvedValue(undefined);
  });

  afterEach(() => vi.useRealTimers());

  it('ends the local session exactly 120 minutes after it started', async () => {
    render(<AuthProvider><AuthStatus /></AuthProvider>);
    await screen.findByText('authenticated');

    await act(async () => {
      vi.advanceTimersByTime(7_200_000);
      await Promise.resolve();
    });

    await waitFor(() => expect(screen.getByText('anonymous')).toBeVisible());
    expect(apiMocks.apiVoid).toHaveBeenCalledWith('/auth/logout', expect.objectContaining({ method: 'POST' }));
    expect(apiMocks.setAccessToken).toHaveBeenLastCalledWith(null);
  });
});
