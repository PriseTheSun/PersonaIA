import { AlertCircle, Inbox, RefreshCcw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

export function LoadingRows({ rows = 5 }: { rows?: number }) {
  return (
    <div className="divide-y" role="status" aria-label="Loading">
      {Array.from({ length: rows }).map((_, index) => (
        <div className="flex items-center gap-3 px-4 py-4" key={index}>
          <Skeleton className="size-9 shrink-0 rounded-full" />
          <div className="flex-1 space-y-2"><Skeleton className="h-4 w-2/5" /><Skeleton className="h-3 w-1/4" /></div>
          <Skeleton className="hidden h-5 w-20 sm:block" />
        </div>
      ))}
      <span className="sr-only">Loading</span>
    </div>
  );
}

export function EmptyState({ title, description, action }: { title: string; description: string; action?: React.ReactNode }) {
  return (
    <div className="flex min-h-64 flex-col items-center justify-center px-5 py-12 text-center">
      <span className="mb-4 grid size-11 place-items-center rounded-full bg-muted"><Inbox className="size-5 text-muted-foreground" aria-hidden="true" /></span>
      <h2 className="text-base font-semibold">{title}</h2>
      <p className="mt-1 max-w-md text-sm leading-6 text-muted-foreground">{description}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function ErrorState({ onRetry, title, description }: { onRetry: () => void; title?: string; description?: string }) {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-64 flex-col items-center justify-center px-5 py-12 text-center" role="alert">
      <span className="mb-4 grid size-11 place-items-center rounded-full bg-secondary text-secondary-foreground"><AlertCircle className="size-5" aria-hidden="true" /></span>
      <h2 className="text-base font-semibold">{title ?? t('common.errorTitle')}</h2>
      <p className="mt-1 max-w-md text-sm leading-6 text-muted-foreground">{description ?? t('common.errorDescription')}</p>
      <Button variant="outline" className="mt-5" onClick={onRetry}><RefreshCcw aria-hidden="true" />{t('common.retry')}</Button>
    </div>
  );
}
