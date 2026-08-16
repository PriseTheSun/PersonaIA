import { Bell, CheckCheck } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { NotificationContent } from '@/features/notifications/notification-content';
import { notificationDestination } from '@/features/notifications/notification-destination';
import { apiRequest, apiVoid, csrfHeaders } from '@/lib/api';
import { notificationsResponseSchema, type AppNotification } from '@/lib/schemas';

const POLL_INTERVAL_MS = 30_000;

export function NotificationsMenu() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const mounted = useRef(true);
  const [markingAll, setMarkingAll] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [notifications, setNotifications] = useState({ items: [] as AppNotification[], unreadCount: 0 });

  const refresh = useCallback(async () => {
    try {
      const next = await apiRequest('/notifications?page=1&pageSize=10&status=ALL', notificationsResponseSchema);
      if (mounted.current) {
        setNotifications(next);
        setLoadError(false);
      }
    } catch {
      if (mounted.current) setLoadError(true);
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    void refresh();
    const interval = window.setInterval(() => void refresh(), POLL_INTERVAL_MS);
    return () => {
      mounted.current = false;
      window.clearInterval(interval);
    };
  }, [refresh]);

  const markAllRead = async () => {
    setMarkingAll(true);
    try {
      await apiVoid('/notifications/read-all', { method: 'PATCH', headers: csrfHeaders() });
      await refresh();
    } catch {
      toast.error(t('notifications.updateError'));
    } finally {
      setMarkingAll(false);
    }
  };

  const openNotification = async (notification: AppNotification) => {
    if (!notification.readAt) {
      try {
        await apiVoid(`/notifications/${encodeURIComponent(notification.id)}/read`, { method: 'PATCH', headers: csrfHeaders() });
      } catch {
        toast.error(t('notifications.updateError'));
      }
    }
    const destination = notificationDestination(notification);
    if (destination) navigate(destination);
    await refresh();
  };

  return (
    <DropdownMenu onOpenChange={(open) => { if (open) void refresh(); }}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={notifications.unreadCount > 0 ? t('notifications.titleWithUnread', { count: notifications.unreadCount }) : t('notifications.title')}
        >
          <Bell aria-hidden="true" />
          {notifications.unreadCount > 0 ? (
            <span className="absolute right-0.5 top-0.5 flex min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-4 text-primary-foreground ring-2 ring-background" aria-hidden="true">
              {notifications.unreadCount > 99 ? '99+' : notifications.unreadCount}
            </span>
          ) : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[22rem] max-w-[calc(100vw-2rem)] p-0">
        <div className="flex min-h-12 items-center justify-between gap-3 px-3 py-2">
          <DropdownMenuLabel className="p-0 text-sm font-semibold text-foreground">{t('notifications.title')}</DropdownMenuLabel>
          {notifications.unreadCount > 0 ? (
            <Button variant="ghost" size="sm" className="h-8 px-2 text-xs" loading={markingAll} onClick={() => void markAllRead()}>
              <CheckCheck aria-hidden="true" />{t('notifications.markAllRead')}
            </Button>
          ) : null}
        </div>
        <DropdownMenuSeparator className="m-0" />
        {loading ? (
          <div className="space-y-3 p-4" role="status" aria-label={t('notifications.loading')}>
            {[0, 1, 2].map((item) => <div className="flex gap-3" key={item}><Skeleton className="size-9 shrink-0 rounded-full" /><div className="flex-1 space-y-2"><Skeleton className="h-3 w-2/3" /><Skeleton className="h-3 w-full" /></div></div>)}
          </div>
        ) : loadError && notifications.items.length === 0 ? (
          <div className="px-4 py-7 text-center" role="alert">
            <p className="text-sm font-medium text-foreground">{t('notifications.loadError')}</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={() => void refresh()}>{t('common.retry')}</Button>
          </div>
        ) : notifications.items.length === 0 ? (
          <div className="px-4 py-7 text-center" role="status">
            <Bell className="mx-auto size-5 text-muted-foreground" aria-hidden="true" />
            <p className="mt-3 text-sm font-medium text-foreground">{t('notifications.empty')}</p>
            <p className="mx-auto mt-1 max-w-56 text-xs leading-5 text-muted-foreground">{t('notifications.emptyDescription')}</p>
          </div>
        ) : (
          <div className="max-h-96 overflow-y-auto p-1">
            {notifications.items.map((notification) => (
                <DropdownMenuItem
                  key={notification.id}
                  className="items-start gap-3 px-3 py-3 data-[highlighted]:bg-muted"
                  onSelect={() => void openNotification(notification)}
                >
                  <NotificationContent notification={notification} />
                </DropdownMenuItem>
              ))}
          </div>
        )}
        <DropdownMenuSeparator className="m-0" />
        <DropdownMenuItem asChild className="m-1 justify-center font-medium">
          <Link to="/notifications"><Bell aria-hidden="true" />{t('notifications.viewAll')}</Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
