import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { AppLogo } from '@/components/shared/app-logo';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from './auth-store';

export function ProtectedRoute() {
  const auth = useAuth();
  const location = useLocation();
  if (auth.status === 'loading') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6" role="status">
        <AppLogo />
        <div className="w-56 space-y-2"><Skeleton className="h-3 w-full" /><Skeleton className="mx-auto h-3 w-2/3" /></div>
        <span className="sr-only">Loading</span>
      </div>
    );
  }
  if (auth.status === 'anonymous') return <Navigate to="/login" replace state={{ from: location }} />;
  return <Outlet />;
}
