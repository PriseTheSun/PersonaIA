import { Skeleton } from '@/components/ui/skeleton';
import type { DashboardSummary } from '@/lib/schemas';

type DashboardPoint = DashboardSummary['series'][number];
type BucketUnit = DashboardSummary['bucket'];

function formatPeriod(value: string, bucket: BucketUnit, locale: string) {
  const options: Intl.DateTimeFormatOptions = bucket === 'year'
    ? { year: 'numeric', timeZone: 'UTC' }
    : bucket === 'month'
      ? { month: 'short', year: '2-digit', timeZone: 'UTC' }
      : { day: '2-digit', month: 'short', timeZone: 'UTC' };
  return new Intl.DateTimeFormat(locale, options).format(new Date(value));
}

function linePoints(points: DashboardPoint[], key: 'projectsCreated' | 'personasCreated', maximum: number) {
  const width = 1000;
  const height = 210;
  return points.map((point, index) => {
    const x = points.length === 1 ? width / 2 : (index / (points.length - 1)) * width;
    const y = height - (point[key] / maximum) * height;
    return `${x},${y}`;
  }).join(' ');
}

function horizontalLabels(points: DashboardPoint[]) {
  if (points.length <= 4) return points.map((_, index) => index);
  return [0, Math.round((points.length - 1) / 3), Math.round(((points.length - 1) * 2) / 3), points.length - 1];
}

export function DashboardTrendChart({
  points,
  bucket,
  locale,
  title,
  description,
  projectsLabel,
  personasLabel,
  emptyLabel,
  tableCaption,
}: {
  points: DashboardPoint[];
  bucket: BucketUnit;
  locale: string;
  title: string;
  description: string;
  projectsLabel: string;
  personasLabel: string;
  emptyLabel: string;
  tableCaption: string;
}) {
  const maximum = Math.max(1, ...points.flatMap((point) => [point.projectsCreated, point.personasCreated]));
  const hasData = points.some((point) => point.projectsCreated > 0 || point.personasCreated > 0);
  const yLabels = [maximum, Math.round(maximum * 0.67), Math.round(maximum * 0.33), 0];
  const xLabels = horizontalLabels(points);

  return (
    <section className="overflow-hidden rounded-lg border bg-card" aria-labelledby="creation-trend-title">
      <div className="flex flex-col gap-3 border-b px-4 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-5">
        <div>
          <h2 id="creation-trend-title" className="font-semibold">{title}</h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground" aria-label={title}>
          <span className="inline-flex items-center gap-2"><span className="size-2.5 rounded-full bg-primary" />{projectsLabel}</span>
          <span className="inline-flex items-center gap-2"><span className="size-2.5 rounded-full bg-foreground" />{personasLabel}</span>
        </div>
      </div>
      <div className="px-3 pb-4 pt-5 sm:px-5 sm:pb-5">
        <div className="flex gap-3">
          <div className="flex h-[210px] w-7 shrink-0 flex-col justify-between text-right text-[11px] tabular-nums text-muted-foreground" aria-hidden="true">
            {yLabels.map((label, index) => <span key={`${label}-${index}`}>{label}</span>)}
          </div>
          <div className="relative h-[210px] min-w-0 flex-1">
            <svg viewBox="0 0 1000 210" preserveAspectRatio="none" className="h-full w-full overflow-visible" aria-hidden="true">
              {[0, 70, 140, 210].map((y) => <line key={y} x1="0" x2="1000" y1={y} y2={y} className="stroke-border" vectorEffect="non-scaling-stroke" />)}
              {hasData ? (
                <>
                  <polyline points={linePoints(points, 'projectsCreated', maximum)} fill="none" className="stroke-primary" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
                  <polyline points={linePoints(points, 'personasCreated', maximum)} fill="none" className="stroke-foreground" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
                </>
              ) : null}
            </svg>
            {!hasData ? <div className="absolute inset-0 grid place-items-center px-4 text-center text-sm text-muted-foreground">{emptyLabel}</div> : null}
          </div>
        </div>
        <div className="ml-10 mt-3 flex justify-between text-[11px] text-muted-foreground" aria-hidden="true">
          {xLabels.map((index) => <span key={points[index]?.periodStart}>{points[index] ? formatPeriod(points[index].periodStart, bucket, locale) : ''}</span>)}
        </div>
      </div>
      <table className="sr-only">
        <caption>{tableCaption}</caption>
        <thead><tr><th>{title}</th><th>{projectsLabel}</th><th>{personasLabel}</th></tr></thead>
        <tbody>{points.map((point) => (
          <tr key={point.periodStart}>
            <th>{formatPeriod(point.periodStart, bucket, locale)}</th>
            <td>{point.projectsCreated}</td>
            <td>{point.personasCreated}</td>
          </tr>
        ))}</tbody>
      </table>
    </section>
  );
}

export function DashboardTrendChartSkeleton({ title, description }: { title: string; description: string }) {
  return (
    <section className="overflow-hidden rounded-lg border bg-card" aria-label={title} aria-busy="true">
      <div className="border-b px-4 py-4 sm:px-5">
        <h2 className="font-semibold">{title}</h2>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p>
      </div>
      <div className="px-4 py-5 sm:px-5">
        <div className="flex h-[210px] items-end gap-3">
          <Skeleton className="h-full w-7" />
          <Skeleton className="h-2/5 flex-1" />
          <Skeleton className="h-3/5 flex-1" />
          <Skeleton className="h-1/2 flex-1" />
          <Skeleton className="h-4/5 flex-1" />
          <Skeleton className="h-2/3 flex-1" />
        </div>
      </div>
    </section>
  );
}
