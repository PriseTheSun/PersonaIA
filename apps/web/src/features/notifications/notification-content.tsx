import { Bell, FolderClock, UserRoundPlus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { AppNotification } from '@/lib/schemas';
import { cn, formatDate } from '@/lib/utils';

function payloadText(notification: AppNotification, key: string) {
  const value = notification.payload[key];
  return typeof value === 'string' ? value : '';
}

export function NotificationContent({ notification, roomy = false }: { notification: AppNotification; roomy?: boolean }) {
  const { t, i18n } = useTranslation();
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
    <>
      <span className={cn('mt-0.5 flex shrink-0 items-center justify-center rounded-full border border-primary/20 bg-primary/10 text-primary', roomy ? 'size-10' : 'size-9')}>
        {accessRequest ? <UserRoundPlus className="size-4" aria-hidden="true" /> : missingProject ? <FolderClock className="size-4" aria-hidden="true" /> : <Bell className="size-4" aria-hidden="true" />}
      </span>
      <span className="min-w-0 flex-1 text-left">
        <span className="flex items-start justify-between gap-2">
          <span className="font-medium text-foreground">{title}</span>
          {!notification.readAt ? <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" aria-label={t('notifications.unread')} /> : null}
        </span>
        <span className={cn('mt-0.5 block text-xs leading-5 text-muted-foreground', roomy && 'max-w-[75ch] sm:text-sm sm:leading-6')}>{description}</span>
        <span className="mt-1 flex flex-wrap items-center gap-x-2 text-[11px] text-muted-foreground">
          <time dateTime={notification.createdAt}>{formatDate(notification.createdAt, i18n.language)}</time>
          {notification.resolvedAt ? <span>· {t('notifications.resolved')}</span> : null}
          {notification.readAt ? <span>· {t('notifications.read')}</span> : null}
        </span>
      </span>
    </>
  );
}
