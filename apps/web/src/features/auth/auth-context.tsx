import { type PropsWithChildren, useCallback, useEffect, useMemo, useState } from 'react';
import { z } from 'zod';
import { apiRequest, apiVoid, csrfHeaders, getCsrfToken, restoreAccessToken, setAccessToken, setScopeContext, setUnauthorizedHandler } from '@/lib/api';
import { authContextSchema, type LoginInput, type User, userSchema } from '@/lib/schemas';
import { AuthContext, type ActiveScope, type AuthContextValue, type AuthState } from './auth-store';

const SCOPE_STORAGE_KEY = 'personaia.active-scope';
const currentUserResponseSchema = z.union([
  userSchema,
  z.object({ user: userSchema, contexts: z.array(authContextSchema).optional() }),
  z.object({ identity: userSchema, contexts: z.array(authContextSchema).default([]) }),
]).transform((value) => {
  if ('identity' in value) return { ...value.identity, contexts: value.contexts };
  if ('user' in value) return { ...value.user, contexts: value.contexts ?? value.user.contexts };
  return value;
});
const loginResponseSchema = z.object({ accessToken: z.string().min(1), user: userSchema.optional() });

function readStoredScope(): ActiveScope | null {
  try {
    const raw = window.localStorage.getItem(SCOPE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = z.object({ tenantId: z.string().min(1), workspaceId: z.string().min(1).optional() }).safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

function normalizeScope(user: User, requested: ActiveScope | null): ActiveScope | null {
  if (user.role === 'SUPER_ADMIN' && requested?.tenantId) return requested;
  const contexts = user.contexts ?? [];
  const context = contexts.find((item) => item.tenantId === requested?.tenantId && item.status === 'ACTIVE')
    ?? contexts.find((item) => item.status === 'ACTIVE');
  if (!context) return null;
  if (requested?.tenantId && !requested.workspaceId && context.clientRole === 'CLIENT_ADMIN') return { tenantId: context.tenantId };
  const workspace = context.workspaces.find((item) => item.id === requested?.workspaceId && item.status === 'ACTIVE')
    ?? context.workspaces.find((item) => item.status === 'ACTIVE');
  return { tenantId: context.tenantId, ...(workspace ? { workspaceId: workspace.id } : {}) };
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [state, setState] = useState<AuthState>({ status: 'loading', user: null });
  const [activeScope, setActiveScope] = useState<ActiveScope | null>(() => readStoredScope());

  useEffect(() => {
    setUnauthorizedHandler(() => setState({ status: 'anonymous', user: null }));
    return () => setUnauthorizedHandler(null);
  }, []);

  const refresh = useCallback(async () => {
    if (!getCsrfToken()) {
      setState({ status: 'anonymous', user: null });
      return;
    }
    try {
      await restoreAccessToken();
      const user = await apiRequest('/auth/me', currentUserResponseSchema);
      setState({ status: 'authenticated', user });
      setActiveScope((current) => normalizeScope(user, current));
    } catch {
      setState({ status: 'anonymous', user: null });
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const login = useCallback(async (input: LoginInput) => {
    const response = await apiRequest('/auth/login', loginResponseSchema, { method: 'POST', body: input, headers: csrfHeaders() });
    setAccessToken(response.accessToken);
    const user = response.user && (response.user.role === 'SUPER_ADMIN' || response.user.contexts)
      ? response.user
      : await apiRequest('/auth/me', currentUserResponseSchema);
    setState({ status: 'authenticated', user });
    setActiveScope((current) => normalizeScope(user, current));
    return user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiVoid('/auth/logout', { method: 'POST', headers: csrfHeaders() });
    } finally {
      setAccessToken(null);
      setScopeContext({});
      setState({ status: 'anonymous', user: null });
    }
  }, []);

  const selectScope = useCallback((scope: ActiveScope | null) => {
    if (state.status !== 'authenticated') return;
    setActiveScope(normalizeScope(state.user, scope));
  }, [state]);

  useEffect(() => {
    setScopeContext(activeScope ?? {});
    if (activeScope) window.localStorage.setItem(SCOPE_STORAGE_KEY, JSON.stringify(activeScope));
    else window.localStorage.removeItem(SCOPE_STORAGE_KEY);
  }, [activeScope]);

  const activeContext = state.status === 'authenticated'
    ? state.user.contexts?.find((item) => item.tenantId === activeScope?.tenantId) ?? null
    : null;
  const selectedWorkspace = activeContext?.workspaces.find((item) => item.id === activeScope?.workspaceId);
  const effectiveRole = state.status !== 'authenticated'
    ? null
    : state.user.role === 'SUPER_ADMIN'
      ? 'SUPER_ADMIN'
      : activeContext?.clientRole === 'CLIENT_ADMIN'
        ? 'CLIENT_ADMIN'
        : selectedWorkspace?.role ?? (state.user.role === 'PROJECT_USER' ? 'WORKSPACE_MEMBER' : state.user.role);

  const value = useMemo<AuthContextValue>(() => ({ ...state, login, logout, refresh, activeScope, activeContext, effectiveRole, selectScope }), [state, login, logout, refresh, activeScope, activeContext, effectiveRole, selectScope]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
