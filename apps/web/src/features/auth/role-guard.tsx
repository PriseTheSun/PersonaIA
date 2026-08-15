import { Navigate, Outlet } from 'react-router-dom';
import type { Role } from '@/lib/schemas';
import { useAuth } from './auth-store';

export function RoleGuard({ allow }: { allow: Role[] }) {
  const auth = useAuth();
  if (auth.status !== 'authenticated') return <Navigate to="/login" replace />;
  return allow.includes(auth.user.role) ? <Outlet /> : <Navigate to="/403" replace />;
}
