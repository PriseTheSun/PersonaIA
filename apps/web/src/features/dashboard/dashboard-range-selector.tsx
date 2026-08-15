import { CalendarDays } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import type { DashboardRange } from '@/lib/schemas';

const ranges: DashboardRange[] = ['7d', '30d', '12m', '5y'];

export function DashboardRangeSelector({ value, onChange }: { value: DashboardRange; onChange: (range: DashboardRange) => void }) {
  const { t } = useTranslation();

  return (
    <fieldset className="min-w-0">
      <legend className="sr-only">{t('dashboard.periodFilter')}</legend>
      <div className="flex min-w-max items-center gap-1 rounded-lg border bg-card p-1" role="group" aria-label={t('dashboard.periodFilter')}>
        <CalendarDays className="ml-1 hidden size-4 text-muted-foreground sm:block" aria-hidden="true" />
        {ranges.map((range) => (
          <Button
            key={range}
            type="button"
            size="sm"
            variant={value === range ? 'secondary' : 'ghost'}
            className="px-2.5 sm:px-3"
            aria-pressed={value === range}
            onClick={() => onChange(range)}
          >
            {t(`dashboard.ranges.${range}`)}
          </Button>
        ))}
      </div>
    </fieldset>
  );
}
