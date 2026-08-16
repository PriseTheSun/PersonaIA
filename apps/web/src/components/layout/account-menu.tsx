import { ChevronUp, LogOut, Settings } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Avatar } from '@/components/shared/avatar';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from '@/components/ui/sidebar';
import { useAuth } from '@/features/auth/auth-store';
import { useCurrentAvatar } from '@/features/preferences/use-current-avatar';

export function AccountMenu() {
  const { t } = useTranslation();
  const auth = useAuth();
  const { isMobile, setOpenMobile } = useSidebar();
  const avatarUrl = useCurrentAvatar(auth.status === 'authenticated' ? auth.user.hasAvatar : false, auth.status === 'authenticated' ? auth.user.avatarUpdatedAt : null);
  if (auth.status !== 'authenticated') return null;

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton size="lg" tooltip={t('common.account')} aria-label={t('common.account')}>
              <Avatar name={auth.user.name} src={avatarUrl} className="size-8" />
              <span className="grid min-w-0 flex-1 gap-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{auth.user.name}</span>
                <Badge variant="outline" className="w-fit max-w-full truncate border-sidebar-border bg-sidebar-accent px-1.5 py-0 text-[10px] leading-4 text-sidebar-accent-foreground">
                  {t(`roles.${auth.effectiveRole ?? auth.user.role}`)}
                </Badge>
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
            <DropdownMenuItem asChild>
              <Link to="/preferences" onClick={() => { if (isMobile) setOpenMobile(false); }}>
                <Settings />{t('preferences.menu')}
              </Link>
            </DropdownMenuItem>
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
