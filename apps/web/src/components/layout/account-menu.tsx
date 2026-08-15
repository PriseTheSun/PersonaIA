import { ChevronUp, LogOut } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Avatar } from '@/components/shared/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useAuth } from '@/features/auth/auth-store';

export function AccountMenu() {
  const { t } = useTranslation();
  const auth = useAuth();
  if (auth.status !== 'authenticated') return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex min-h-11 w-full max-w-full items-center gap-2 rounded-md px-1.5 text-left hover:bg-muted" aria-label={t('common.account')}>
        <Avatar name={auth.user.name} className="size-8" />
        <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{auth.user.name}</span><span className="block truncate text-xs text-muted-foreground">{t(`roles.${auth.user.role}`)}</span></span>
        <ChevronUp className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start" sideOffset={8} className="w-56">
        <DropdownMenuLabel className="py-2">
          <span className="block truncate text-sm font-medium text-foreground">{auth.user.name}</span>
          <span className="mt-0.5 block truncate font-normal">{auth.user.email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="text-destructive" onSelect={() => void auth.logout()}><LogOut />{t('common.signOut')}</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
