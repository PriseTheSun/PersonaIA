import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function DataRegion({ toolbar, children, className }: { toolbar?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn('overflow-hidden rounded-lg border bg-card', className)}>
      {toolbar ? <div className="flex min-h-16 items-center border-b px-3 py-3 sm:px-4">{toolbar}</div> : null}
      {children}
    </section>
  );
}
