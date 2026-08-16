import { Bell, CheckCheck, FolderClock, UserRoundPlus } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { apiRequest, apiVoid, csrfHeaders } from '@/lib/api';
import { notificationsResponseSchema, type AppNotification } from '@/lib/schemas';
import { cn, formatDate } from '@/lib/utils';

const POLL_INTERVAL_MS = 30_000;

function payloadText(notification: AppNotification, key: string) {
  const value = notification.payload[key];
  return typeof value === 'string' ? value : '';
}

export function NotificationsMenu() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const mounted = useRef(true);
  const [markingAll, setMarkingAll] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [notifications, setNotifications] = useState({ items: [] as AppNotification[], unreadCount: 0 });

  const refresh = useCallback(async () => {
    try {
      const next = await apiRequest('/notifications', notificationsResponseSchema);
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
    const next = new URLSearchParams({ status: notification.resolvedAt ? 'ALL' : 'PENDING' });
    if (notification.tenantId) next.set('tenant', notification.tenantId);
    else next.set('view', 'PLATFORM');
    navigate(`/access-control?${next.toString()}`);
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
            {notifications.items.map((notification) => {
              const accessRequest = notification.type === 'ACCESS_REQUESTED';
              const missingProject = notification.type === 'USER_LOGIN_WITHOUT_PROJECT';
              const requestedProjectName = payloadText(notification, 'requestedProjectName');
              const title = accessRequest
                ? t('notifications.accessRequestedTitle')
                : missingProject ? t('notifications.missingProjectTitle') : t('notifications.newActivity');
              const description = accessRequest
                ? t(!notification.tenantId ? 'notifications.globalAccessRequestedDescription' : requestedProjectName ? 'notifications.accessRequestedForProjectDescription' : 'notifications.accessRequestedDescription', {
                    userName: payloadText(notification, 'userName'),
                    userEmail: payloadText(notification, 'userEmail'),
                    tenantName: payloadText(notification, 'tenantName'),
                    projectName: requestedProjectName,
                  })
                : missingProject
                  ? t('notifications.missingProjectDescription', {
                      userName: payloadText(notification, 'userName'),
                      userEmail: payloadText(notification, 'userEmail'),
                      tenantName: payloadText(notification, 'tenantName'),
                    })
                : t('notifications.newActivityDescription');
              return (
                <DropdownMenuItem
                  key={notification.id}
                  className={cn('items-start gap-3 px-3 py-3', !notification.readAt && 'bg-primary/5')}
                  onSelect={() => void openNotification(notification)}
                >
                  <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full border border-primary/20 bg-primary/10 text-primary">
                    {accessRequest ? <UserRoundPlus className="size-4" aria-hidden="true" /> : missingProject ? <FolderClock className="size-4" aria-hidden="true" /> : <Bell className="size-4" aria-hidden="true" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-start justify-between gap-2">
                      <span className="font-medium text-foreground">{title}</span>
                      {!notification.readAt ? <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" aria-label={t('notifications.unread')} /> : null}
                    </span>
                    <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">{description}</span>
                    <span className="mt-1 flex flex-wrap items-center gap-x-2 text-[11px] text-muted-foreground">
                      <time dateTime={notification.createdAt}>{formatDate(notification.createdAt, i18n.language)}</time>
                      {notification.resolvedAt ? <span>· {t('notifications.resolved')}</span> : null}
                    </span>
                  </span>
                </DropdownMenuItem>
              );
            })}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
