import { cn } from '@/lib/utils';

export function AppLogo({ compact = false, className }: { compact?: boolean; className?: string }) {
  return (
    <div className={cn('flex items-center gap-2.5', className)} aria-label="PersonaIA">
      <div className="grid size-8 shrink-0 place-items-center rounded-md bg-primary text-sm font-semibold text-primary-foreground" aria-hidden="true">P</div>
      {!compact ? <span className="text-sm font-semibold tracking-[-0.015em]">PersonaIA</span> : null}
    </div>
  );
}
