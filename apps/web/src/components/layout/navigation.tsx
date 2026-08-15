import { FolderKanban, Gauge, KeyRound, ShieldCheck, Users, Building2, UserRoundCog } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { NavLink, useLocation } from 'react-router-dom';
import type { Role } from '@/lib/schemas';
import { SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from '@/components/ui/sidebar';

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
  const { isMobile, setOpenMobile } = useSidebar();

  return (
    <nav aria-label={t('common.menu')}>
      <SidebarGroup>
        <SidebarGroupLabel>{t('nav.platform')}</SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            {items.filter((item) => (item.roles as Role[]).includes(role)).map(({ to, label, icon: Icon }) => {
              const isActive = to === '/' ? location.pathname === '/' : location.pathname === to || location.pathname.startsWith(`${to}/`);
              return (
                <SidebarMenuItem key={to}>
                  <SidebarMenuButton asChild isActive={isActive} tooltip={t(label)}>
                    <NavLink
                      to={to}
                      end={to === '/'}
                      onClick={() => {
                        onNavigate?.();
                        if (isMobile) setOpenMobile(false);
                      }}
                      aria-label={t(label)}
                    >
                      <Icon aria-hidden="true" />
                      <span>{t(label)}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    </nav>
  );
}
