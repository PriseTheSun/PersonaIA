import { cn, getInitials } from '@/lib/utils';

export function Avatar({ name, className }: { name: string; className?: string }) {
  return (
    <span className={cn('inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-secondary-foreground', className)} aria-hidden="true">
      {getInitials(name)}
    </span>
  );
}
