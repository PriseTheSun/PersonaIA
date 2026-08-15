import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
  sessionStorage.clear();
});

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: { 'Content-Type': 'application/json' } });
}

describe('secure API client', () => {
  it('refreshes once after a 401 and keeps the access token out of storage', async () => {
    vi.resetModules();
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ message: 'Unauthorized' }, 401))
      .mockResolvedValueOnce(jsonResponse({ accessToken: 'memory-only-token' }))
      .mockResolvedValueOnce(jsonResponse({ ok: true }));
    vi.stubGlobal('fetch', fetchMock);
    const { apiRequest } = await import('./api');
    await expect(apiRequest('/protected', z.object({ ok: z.boolean() }))).resolves.toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[2]?.[1]?.headers).toMatchObject({ Authorization: 'Bearer memory-only-token' });
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
  });

  it('restores the in-memory access token before loading the current user', async () => {
    vi.resetModules();
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ accessToken: 'restored-token' }))
      .mockResolvedValueOnce(jsonResponse({ id: 'user-1' }));
    vi.stubGlobal('fetch', fetchMock);
    const { apiRequest, restoreAccessToken } = await import('./api');

    await restoreAccessToken();
    await apiRequest('/auth/me', z.object({ id: z.string() }));

    expect(fetchMock.mock.calls[0]?.[0]).toContain('/auth/refresh');
    expect(fetchMock.mock.calls[1]?.[1]?.headers).toMatchObject({ Authorization: 'Bearer restored-token' });
  });

  it('rejects a response that violates its Zod contract', async () => {
    vi.resetModules();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ count: 'not-a-number' })));
    const { apiRequest, ApiError } = await import('./api');
    await expect(apiRequest('/summary', z.object({ count: z.number() }))).rejects.toBeInstanceOf(ApiError);
  });
});
