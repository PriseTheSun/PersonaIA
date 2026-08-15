import { Bell } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

export function NotificationsMenu() {
  const { t } = useTranslation();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={t('notifications.title')}>
          <Bell aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 max-w-[calc(100vw-2rem)]">
        <DropdownMenuLabel className="px-3 py-2 text-sm font-semibold text-foreground">{t('notifications.title')}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <div className="px-4 py-7 text-center" role="status">
          <Bell className="mx-auto size-5 text-muted-foreground" aria-hidden="true" />
          <p className="mt-3 text-sm font-medium text-foreground">{t('notifications.empty')}</p>
          <p className="mx-auto mt-1 max-w-56 text-xs leading-5 text-muted-foreground">{t('notifications.emptyDescription')}</p>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
