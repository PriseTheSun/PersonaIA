import { Suspense, type ReactNode } from 'react';
import { Skeleton } from '@/components/ui/skeleton';

export function RouteLoading({ children }: { children: ReactNode }) {
  return <Suspense fallback={<div className="space-y-5" role="status"><Skeleton className="h-8 w-48" /><Skeleton className="h-4 w-80 max-w-full" /><Skeleton className="h-64 w-full" /><span className="sr-only">Loading</span></div>}>{children}</Suspense>;
}
