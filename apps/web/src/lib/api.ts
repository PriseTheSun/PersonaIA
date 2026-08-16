import { z } from 'zod';

const API_BASE_URL = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ?? '/api/v1';
let accessToken: string | null = null;
let refreshPromise: Promise<string> | null = null;
let unauthorizedHandler: (() => void) | null = null;
let scopeContext: { tenantId?: string; workspaceId?: string } = {};

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
}

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export function setUnauthorizedHandler(handler: (() => void) | null) {
  unauthorizedHandler = handler;
}

export function setScopeContext(context: { tenantId?: string; workspaceId?: string }) {
  scopeContext = context;
}

function isJsonResponse(response: Response) {
  return response.headers.get('content-type')?.includes('application/json');
}

async function refreshAccessToken() {
  if (!refreshPromise) {
    refreshPromise = fetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
      headers: { Accept: 'application/json', ...csrfHeaders() },
    })
      .then(async (response) => {
        if (!response.ok) throw new ApiError(response.status, 'REFRESH_FAILED', response.statusText);
        const payload: unknown = await response.json();
        const parsed = z.object({ accessToken: z.string().min(1) }).safeParse(payload);
        if (!parsed.success) throw new ApiError(502, 'INVALID_REFRESH_RESPONSE', 'The server returned an invalid refresh response.');
        accessToken = parsed.data.accessToken;
        return parsed.data.accessToken;
      })
      .finally(() => { refreshPromise = null; });
  }
  return refreshPromise;
}

export async function restoreAccessToken(): Promise<void> {
  await refreshAccessToken();
}

async function fetchApi(path: string, options: RequestOptions, hasRetried = false): Promise<Response> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      ...(options.body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...(scopeContext.tenantId ? { 'X-Tenant-Id': scopeContext.tenantId } : {}),
      ...(scopeContext.workspaceId ? { 'X-Workspace-Id': scopeContext.workspaceId } : {}),
      ...options.headers,
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });

  const canRefresh = response.status === 401 && !hasRetried && path !== '/auth/login' && path !== '/auth/refresh';
  if (canRefresh) {
    try {
      await refreshAccessToken();
      return fetchApi(path, options, true);
    } catch {
      accessToken = null;
      unauthorizedHandler?.();
    }
  }
  return response;
}

export async function apiRequest<S extends z.ZodTypeAny>(path: string, schema: S, options: RequestOptions = {}): Promise<z.output<S>> {
  const response = await fetchApi(path, options);

  const payload: unknown = isJsonResponse(response) ? await response.json() : null;

  if (!response.ok) {
    const parsed = z.object({ code: z.string().optional(), message: z.string().optional() }).safeParse(payload);
    throw new ApiError(
      response.status,
      parsed.success ? parsed.data.code ?? 'REQUEST_FAILED' : 'REQUEST_FAILED',
      parsed.success ? parsed.data.message ?? response.statusText : response.statusText,
    );
  }

  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    throw new ApiError(502, 'INVALID_RESPONSE', 'The server returned an invalid response.');
  }

  return parsed.data;
}

export async function apiVoid(path: string, options: RequestOptions = {}): Promise<void> {
  const response = await fetchApi(path, options);
  if (!response.ok) {
    throw new ApiError(response.status, 'REQUEST_FAILED', response.statusText);
  }
}

export async function apiBlob(path: string, options: RequestOptions = {}): Promise<Blob> {
  const response = await fetchApi(path, {
    ...options,
    headers: { Accept: 'image/png,image/jpeg', ...options.headers },
  });
  if (!response.ok) {
    const payload: unknown = isJsonResponse(response) ? await response.json() : null;
    const parsed = z.object({ code: z.string().optional(), message: z.string().optional() }).safeParse(payload);
    throw new ApiError(
      response.status,
      parsed.success ? parsed.data.code ?? 'REQUEST_FAILED' : 'REQUEST_FAILED',
      parsed.success ? parsed.data.message ?? response.statusText : response.statusText,
    );
  }
  return response.blob();
}

export function getCsrfToken() {
  return document.cookie
    .split('; ')
    .find((row) => row.startsWith('XSRF-TOKEN='))
    ?.split('=')
    .slice(1)
    .join('=');
}

export function csrfHeaders(): HeadersInit {
  const token = getCsrfToken();
  return token ? { 'X-CSRF-Token': decodeURIComponent(token) } : {};
}
