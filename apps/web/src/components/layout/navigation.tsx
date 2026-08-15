import { FolderKanban, Gauge, KeyRound, ShieldCheck, Users, Building2, UserRoundCog } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { NavLink, useLocation } from 'react-router-dom';
import type { Role } from '@/lib/schemas';
import { SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarMenu, SidebarMenuItem } from '@/components/ui/sidebar';
import { useSidebar } from '@/components/ui/sidebar-context';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

const items = [
  { to: '/', label: 'nav.overview', icon: Gauge, roles: ['SUPER_ADMIN', 'CLIENT_ADMIN', 'PROJECT_USER'] },
  { to: '/access-control', label: 'nav.accessControl', icon: UserRoundCog, roles: ['SUPER_ADMIN', 'CLIENT_ADMIN'] },
  { to: '/tenants', label: 'nav.tenants', icon: Building2, roles: ['SUPER_ADMIN'] },
  { to: '/administrators', label: 'nav.admins', icon: ShieldCheck, roles: ['SUPER_ADMIN'] },
  { to: '/projects', label: 'nav.projects', icon: FolderKanban, roles: ['CLIENT_ADMIN'] },
  { to: '/users', label: 'nav.users', icon: Users, roles: ['CLIENT_ADMIN'] },
  { to: '/permissions', label: 'nav.permissions', icon: KeyRound, roles: ['CLIENT_ADMIN'] },
] satisfies Array<{ to: string; label: string; icon: typeof Gauge; roles: Role[] }>;

export function Navigation({ role, onNavigate }: { role: Role; onNavigate?: () => void }) {
  const { t } = useTranslation();
  const location = useLocation();
  const { isDesktop, open } = useSidebar();
  const showTooltips = isDesktop && !open;

  return (
    <nav aria-label={t('common.menu')}>
      <SidebarGroup>
        <SidebarGroupLabel>{t('nav.platform')}</SidebarGroupLabel>
        <SidebarGroupContent>
          <TooltipProvider delayDuration={250} skipDelayDuration={100}>
            <SidebarMenu>
              {items.filter((item) => (item.roles as Role[]).includes(role)).map(({ to, label, icon: Icon }) => (
                <SidebarMenuItem key={to}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <NavLink
                        to={to}
                        end={to === '/'}
                        onClick={onNavigate}
                        aria-label={t(label)}
                        className={cn(
                          'flex min-h-10 w-full min-w-0 flex-nowrap items-center gap-3 whitespace-nowrap rounded-md px-3 text-sm font-medium text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground group-data-[collapsible=icon]/sidebar:justify-center group-data-[collapsible=icon]/sidebar:gap-0 group-data-[collapsible=icon]/sidebar:px-0',
                          (to === '/' ? location.pathname === '/' : location.pathname === to || location.pathname.startsWith(`${to}/`)) && 'bg-sidebar-accent text-sidebar-accent-foreground',
                        )}
                      >
                        <Icon className="size-[18px] shrink-0" aria-hidden="true" />
                        <span className="min-w-0 flex-1 truncate whitespace-nowrap group-data-[collapsible=icon]/sidebar:sr-only">{t(label)}</span>
                      </NavLink>
                    </TooltipTrigger>
                    {showTooltips ? <TooltipContent side="right">{t(label)}</TooltipContent> : null}
                  </Tooltip>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </TooltipProvider>
        </SidebarGroupContent>
      </SidebarGroup>
    </nav>
  );
}
