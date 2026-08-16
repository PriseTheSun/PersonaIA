import { ClipboardList, FolderKanban, Gauge, KeyRound, PanelsTopLeft, ScanFace, ScrollText, ShieldCheck, Users, Building2, UserRoundCog } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { NavLink, useLocation } from 'react-router-dom';
import type { Role } from '@/lib/schemas';
import type { FunctionalFeature } from '@/lib/schemas';
import { useAuth } from '@/features/auth/auth-store';
import { SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from '@/components/ui/sidebar';

type NavigationItem = { to: string; label: string; icon: typeof Gauge; roles: Role[]; feature?: FunctionalFeature };

const platformItems = [
  { to: '/', label: 'nav.overview', icon: Gauge, roles: ['SUPER_ADMIN', 'CLIENT_ADMIN', 'WORKSPACE_ADMIN', 'WORKSPACE_MEMBER', 'PROJECT_USER'], feature: 'DASHBOARD' },
  { to: '/access-control', label: 'nav.accessControl', icon: UserRoundCog, roles: ['SUPER_ADMIN', 'CLIENT_ADMIN'] },
  { to: '/tenants', label: 'nav.tenants', icon: Building2, roles: ['SUPER_ADMIN'] },
  { to: '/administrators', label: 'nav.admins', icon: ShieldCheck, roles: ['SUPER_ADMIN'] },
  { to: '/audit', label: 'nav.audit', icon: ScrollText, roles: ['SUPER_ADMIN'] },
] satisfies NavigationItem[];

const workspaceItems = [
  { to: '/workspaces', label: 'nav.workspaces', icon: PanelsTopLeft, roles: ['SUPER_ADMIN', 'CLIENT_ADMIN', 'WORKSPACE_ADMIN', 'WORKSPACE_MEMBER', 'PROJECT_USER'] },
  { to: '/projects', label: 'nav.projects', icon: FolderKanban, roles: ['SUPER_ADMIN', 'CLIENT_ADMIN', 'WORKSPACE_ADMIN', 'WORKSPACE_MEMBER', 'PROJECT_USER'] },
  { to: '/users', label: 'nav.users', icon: Users, roles: ['SUPER_ADMIN', 'CLIENT_ADMIN', 'WORKSPACE_ADMIN'] },
  { to: '/permissions', label: 'nav.permissions', icon: KeyRound, roles: ['SUPER_ADMIN', 'CLIENT_ADMIN', 'WORKSPACE_ADMIN'] },
  { to: '/personas', label: 'nav.personas', icon: ScanFace, roles: ['SUPER_ADMIN', 'CLIENT_ADMIN', 'WORKSPACE_ADMIN', 'WORKSPACE_MEMBER', 'PROJECT_USER'], feature: 'PERSONA' },
  { to: '/questionnaires', label: 'nav.questionnaires', icon: ClipboardList, roles: ['SUPER_ADMIN', 'CLIENT_ADMIN', 'WORKSPACE_ADMIN', 'WORKSPACE_MEMBER', 'PROJECT_USER'], feature: 'RESEARCH' },
] satisfies NavigationItem[];

function NavigationGroup({ label, items, role, onNavigate }: { label: string; items: NavigationItem[]; role: Role; onNavigate?: () => void }) {
  const { t } = useTranslation();
  const auth = useAuth();
  const location = useLocation();
  const { isMobile, setOpenMobile } = useSidebar();
  const activeWorkspace = auth.activeContext?.workspaces.find((workspace) => workspace.id === auth.activeScope?.workspaceId);
  const implicitAdmin = ['SUPER_ADMIN', 'CLIENT_ADMIN', 'WORKSPACE_ADMIN'].includes(role);
  const visibleItems = items.filter((item) => {
    if (!(item.roles as Role[]).includes(role)) return false;
    if (!item.feature || implicitAdmin) return true;
    const permission = activeWorkspace?.permissions.find((candidate) => candidate.feature === item.feature);
    return permission?.effect === 'ALLOW';
  });
  if (visibleItems.length === 0) return null;
  return (
    <SidebarGroup>
      <SidebarGroupLabel>{t(label)}</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {visibleItems.map(({ to, label: itemLabel, icon: Icon }) => {
            const isActive = to === '/' ? location.pathname === '/' : location.pathname === to || location.pathname.startsWith(`${to}/`);
            return (
              <SidebarMenuItem key={to}>
                <SidebarMenuButton asChild isActive={isActive} tooltip={t(itemLabel)}>
                  <NavLink to={to} end={to === '/'} onClick={() => { onNavigate?.(); if (isMobile) setOpenMobile(false); }} aria-label={t(itemLabel)}>
                    <Icon aria-hidden="true" />
                    <span>{t(itemLabel)}</span>
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

export function Navigation({ role, onNavigate }: { role: Role; onNavigate?: () => void }) {
  const { t } = useTranslation();

  return (
    <nav aria-label={t('common.menu')}>
      <NavigationGroup label="nav.platform" items={platformItems} role={role} onNavigate={onNavigate} />
      <NavigationGroup label="nav.organization" items={workspaceItems} role={role} onNavigate={onNavigate} />
    </nav>
  );
}
