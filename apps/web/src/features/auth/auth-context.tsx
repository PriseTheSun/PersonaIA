import { type PropsWithChildren, useCallback, useEffect, useMemo, useState } from 'react';
import { z } from 'zod';
import { apiRequest, apiVoid, csrfHeaders, getCsrfToken, restoreAccessToken, setAccessToken, setUnauthorizedHandler } from '@/lib/api';
import { type LoginInput, userSchema } from '@/lib/schemas';
import { AuthContext, type AuthContextValue, type AuthState } from './auth-store';
const currentUserResponseSchema = z.union([userSchema, z.object({ user: userSchema })]).transform((value) => 'user' in value ? value.user : value);
const loginResponseSchema = z.object({ accessToken: z.string().min(1), user: userSchema.optional() });

export function AuthProvider({ children }: PropsWithChildren) {
  const [state, setState] = useState<AuthState>({ status: 'loading', user: null });

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
    } catch {
      setState({ status: 'anonymous', user: null });
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const login = useCallback(async (input: LoginInput) => {
    const response = await apiRequest('/auth/login', loginResponseSchema, { method: 'POST', body: input, headers: csrfHeaders() });
    setAccessToken(response.accessToken);
    const user = response.user ?? await apiRequest('/auth/me', currentUserResponseSchema);
    setState({ status: 'authenticated', user });
    return user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiVoid('/auth/logout', { method: 'POST', headers: csrfHeaders() });
    } finally {
      setAccessToken(null);
      setState({ status: 'anonymous', user: null });
    }
  }, []);

  const value = useMemo<AuthContextValue>(() => ({ ...state, login, logout, refresh }), [state, login, logout, refresh]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
