import type { AppNotification } from '@/lib/schemas';

export function notificationDestination(notification: AppNotification) {
  if (!['ACCESS_REQUESTED', 'USER_LOGIN_WITHOUT_PROJECT'].includes(notification.type)) return null;
  const parameters = new URLSearchParams({ status: notification.resolvedAt ? 'ALL' : 'PENDING' });
  if (notification.tenantId) {
    parameters.set('view', 'CLIENT');
    parameters.set('tenant', notification.tenantId);
  } else {
    parameters.set('view', 'PLATFORM');
  }
  return `/access-control?${parameters.toString()}`;
}
