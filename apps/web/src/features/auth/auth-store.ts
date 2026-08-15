import { createContext, useContext } from 'react';
import type { AuthContext as UserAuthContext, LoginInput, Role, User } from '@/lib/schemas';

export type ActiveScope = {
  tenantId: string;
  workspaceId?: string;
};

export type AuthState =
  | { status: 'loading'; user: null }
  | { status: 'authenticated'; user: User }
  | { status: 'anonymous'; user: null };

export type AuthContextValue = AuthState & {
  login: (input: LoginInput) => Promise<User>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  activeScope?: ActiveScope | null;
  activeContext?: UserAuthContext | null;
  effectiveRole?: Role | null;
  selectScope?: (scope: ActiveScope | null) => void;
};

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
