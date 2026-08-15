import { FolderKanban, Gauge, KeyRound, ShieldCheck, Users, Building2, UserRoundCog } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { NavLink } from 'react-router-dom';
import type { Role } from '@/lib/schemas';
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
  return (
    <nav aria-label={t('common.menu')} className="space-y-1">
      {items.filter((item) => (item.roles as Role[]).includes(role)).map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/'}
          onClick={onNavigate}
          className={({ isActive }) => cn('flex min-h-10 items-center gap-3 rounded-md px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground', isActive && 'bg-secondary text-secondary-foreground')}
        >
          <Icon className="size-[18px]" aria-hidden="true" />{t(label)}
        </NavLink>
      ))}
    </nav>
  );
}
