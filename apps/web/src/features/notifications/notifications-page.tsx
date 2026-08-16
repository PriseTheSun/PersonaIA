import { CheckCheck } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { DataRegion } from '@/components/shared/data-region';
import { PageHeader } from '@/components/shared/page-header';
import { EmptyState, ErrorState, LoadingRows } from '@/components/shared/states';
import { Button } from '@/components/ui/button';
import { useApiQuery } from '@/hooks/use-api-query';
import { apiRequest, apiVoid, csrfHeaders } from '@/lib/api';
import { notificationsPageResponseSchema, type AppNotification } from '@/lib/schemas';
import { cn } from '@/lib/utils';
import { NotificationContent } from './notification-content';
import { notificationDestination } from './notification-destination';

const filters = ['ALL', 'UNREAD', 'READ'] as const;
type NotificationFilter = typeof filters[number];
const PAGE_SIZE = 20;

export function NotificationsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedFilter = searchParams.get('status');
  const filter: NotificationFilter = filters.includes(requestedFilter as NotificationFilter) ? requestedFilter as NotificationFilter : 'ALL';
  const requestedPage = Number(searchParams.get('page'));
  const page = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [markingAll, setMarkingAll] = useState(false);
  const queryString = useMemo(() => new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE), status: filter }).toString(), [filter, page]);
  const query = useApiQuery((signal) => apiRequest(`/notifications?${queryString}`, notificationsPageResponseSchema, { signal }), [queryString]);
  const data = query.status === 'success' ? query.data : null;

  useEffect(() => { document.title = `${t('notifications.title')} · ${t('common.appName')}`; }, [t]);

  const updateParameters = (nextFilter: NotificationFilter, nextPage: number) => {
    setSearchParams({ status: nextFilter, page: String(nextPage) }, { replace: true });
  };

  const markAllRead = async () => {
    setMarkingAll(true);
    try {
      await apiVoid('/notifications/read-all', { method: 'PATCH', headers: csrfHeaders() });
      toast.success(t('notifications.allMarkedRead'));
      query.retry();
    } catch {
      toast.error(t('notifications.updateError'));
    } finally {
      setMarkingAll(false);
    }
  };

  const openNotification = async (notification: AppNotification) => {
    setMarkingId(notification.id);
    try {
      if (!notification.readAt) {
        await apiVoid(`/notifications/${encodeURIComponent(notification.id)}/read`, { method: 'PATCH', headers: csrfHeaders() });
      }
      const destination = notificationDestination(notification);
      if (destination) navigate(destination);
      else query.retry();
    } catch {
      toast.error(t('notifications.updateError'));
    } finally {
      setMarkingId(null);
    }
  };

  const toolbar = (
    <div className="flex w-full gap-1 overflow-x-auto" role="group" aria-label={t('notifications.filterLabel')}>
      {filters.map((item) => (
        <Button key={item} size="sm" variant={filter === item ? 'secondary' : 'ghost'} aria-pressed={filter === item} className="shrink-0" onClick={() => updateParameters(item, 1)}>
          {t(`notifications.filters.${item}`)}
          {item === 'UNREAD' && data?.unreadCount ? <span className="tabular-nums text-muted-foreground">{data.unreadCount}</span> : null}
        </Button>
      ))}
    </div>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('notifications.title')}
        description={t('notifications.description')}
        action={data?.unreadCount ? <Button variant="outline" loading={markingAll} onClick={() => void markAllRead()}><CheckCheck aria-hidden="true" />{t('notifications.markAllRead')}</Button> : undefined}
      />
      <DataRegion toolbar={toolbar}>
        {query.status === 'loading' ? <LoadingRows rows={8} /> : query.status === 'error' ? <ErrorState onRetry={query.retry} /> : !data ? <LoadingRows rows={8} /> : data.items.length === 0 ? (
          <EmptyState
            title={filter === 'UNREAD' ? t('notifications.noUnread') : filter === 'READ' ? t('notifications.noRead') : t('notifications.empty')}
            description={filter === 'ALL' ? t('notifications.emptyDescription') : t('notifications.filterEmptyDescription')}
          />
        ) : (
          <>
            <ol className="divide-y" aria-label={t('notifications.listLabel')}>
              {data.items.map((notification) => (
                <li key={notification.id}>
                  <button
                    type="button"
                    className={cn('flex min-h-20 w-full items-start gap-3 px-4 py-4 text-left transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:px-5', !notification.readAt && 'bg-primary/5')}
                    disabled={markingId === notification.id}
                    onClick={() => void openNotification(notification)}
                  >
                    <NotificationContent notification={notification} roomy />
                  </button>
                </li>
              ))}
            </ol>
            <footer className="flex flex-col gap-3 border-t px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground" role="status">{t('notifications.results', { count: data.pagination.total })}</p>
              <nav className="flex items-center justify-between gap-2 sm:justify-end" aria-label={t('notifications.pagination')}>
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => updateParameters(filter, Math.max(1, page - 1))}>{t('common.previous')}</Button>
                <span className="px-1 text-sm tabular-nums">{t('common.page', { current: data.pagination.page, total: data.pagination.totalPages })}</span>
                <Button variant="outline" size="sm" disabled={page >= data.pagination.totalPages} onClick={() => updateParameters(filter, page + 1)}>{t('common.next')}</Button>
              </nav>
            </footer>
          </>
        )}
      </DataRegion>
    </div>
  );
}
