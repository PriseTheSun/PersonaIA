import { ArrowUpRight, type LucideIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

export type DashboardMetric = {
  key: string;
  label: string;
  description: string;
  icon: LucideIcon;
  value?: number;
  href?: string;
  attention?: boolean;
};

export function DashboardMetrics({ items, label }: { items: DashboardMetric[]; label: string }) {
  return (
    <section className="grid gap-px overflow-hidden rounded-lg border bg-border sm:grid-cols-2 xl:grid-cols-4" aria-label={label}>
      {items.map((item) => <DashboardMetricItem key={item.key} item={item} />)}
    </section>
  );
}

function DashboardMetricItem({ item }: { item: DashboardMetric }) {
  const Icon = item.icon;
  const content = (
    <>
      <div className="flex items-start justify-between gap-3">
        <span className={cn(
          'grid size-10 shrink-0 place-items-center rounded-md bg-muted text-foreground',
          item.attention && 'bg-primary text-primary-foreground',
        )}>
          <Icon className="size-5" aria-hidden="true" />
        </span>
        {item.href ? <ArrowUpRight className="size-4 text-muted-foreground transition-colors group-hover:text-foreground" aria-hidden="true" /> : null}
      </div>
      <div className="mt-5">
        <p className="text-sm font-medium text-muted-foreground">{item.label}</p>
        {item.value === undefined ? <Skeleton className="mt-2 h-9 w-20" /> : <p className="mt-1 text-3xl font-semibold tracking-[-0.03em] tabular-nums">{item.value}</p>}
        <p className="mt-2 min-h-10 text-xs leading-5 text-muted-foreground">{item.description}</p>
      </div>
    </>
  );

  return item.href ? (
    <Link to={item.href} className="group min-h-44 bg-card p-5 transition-colors hover:bg-muted/50 focus-visible:z-10" aria-label={`${item.label}: ${item.value ?? ''}`}>
      {content}
    </Link>
  ) : <article className="min-h-44 bg-card p-5">{content}</article>;
}
