import { cn, getInitials } from '@/lib/utils';

export function Avatar({ name, src, alt = '', className }: { name: string; src?: string | null; alt?: string; className?: string }) {
  return (
    <span className={cn('inline-flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-secondary text-xs font-semibold text-secondary-foreground', className)} aria-hidden={src && !alt ? 'true' : undefined}>
      {src ? <img src={src} alt={alt} className="size-full object-cover" /> : <span aria-hidden="true">{getInitials(name)}</span>}
    </span>
  );
}
