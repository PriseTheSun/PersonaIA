import { ChevronUp, LogOut } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Avatar } from '@/components/shared/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from '@/components/ui/sidebar';
import { useAuth } from '@/features/auth/auth-store';

export function AccountMenu() {
  const { t } = useTranslation();
  const auth = useAuth();
  const { isMobile, setOpenMobile } = useSidebar();
  if (auth.status !== 'authenticated') return null;

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton size="lg" tooltip={t('common.account')} aria-label={t('common.account')}>
              <Avatar name={auth.user.name} className="size-8" />
              <span className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{auth.user.name}</span>
                <span className="truncate text-xs text-sidebar-foreground/60">{t(`roles.${auth.user.role}`)}</span>
              </span>
              <ChevronUp className="ml-auto" aria-hidden="true" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent side={isMobile ? 'bottom' : 'top'} align="start" sideOffset={8} className="w-56">
            <DropdownMenuLabel className="py-2">
              <span className="block truncate text-sm font-medium text-foreground">{auth.user.name}</span>
              <span className="mt-0.5 block truncate font-normal">{auth.user.email}</span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive" onSelect={() => {
              if (isMobile) setOpenMobile(false);
              void auth.logout();
            }}><LogOut />{t('common.signOut')}</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
