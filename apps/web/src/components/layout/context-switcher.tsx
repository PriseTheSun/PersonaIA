import { Building2, ChevronsUpDown, PanelsTopLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/features/auth/auth-store';

export function ContextSwitcher() {
  const { t } = useTranslation();
  const auth = useAuth();
  if (auth.status !== 'authenticated') return null;

  const contexts = (auth.user.contexts ?? []).filter((context) => context.status === 'ACTIVE');
  const activeContext = auth.activeContext ?? contexts.find((context) => context.tenantId === auth.activeScope?.tenantId) ?? contexts[0];
  const activeWorkspace = activeContext?.workspaces.find((workspace) => workspace.id === auth.activeScope?.workspaceId && workspace.status === 'ACTIVE');

  if (contexts.length === 0) {
    return auth.user.role === 'SUPER_ADMIN' ? (
      <div className="flex min-w-0 items-center gap-2 rounded-md bg-sidebar-accent px-2 py-2 text-sidebar-accent-foreground group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0" title={t('context.platform')}>
        <Building2 className="size-4 shrink-0" aria-hidden="true" />
        <span className="truncate text-xs font-medium group-data-[collapsible=icon]:hidden">{t('context.platform')}</span>
      </div>
    ) : null;
  }

  return (
    <div className="space-y-2 group-data-[collapsible=icon]:space-y-0">
      <div className="relative group-data-[collapsible=icon]:hidden">
        <Building2 className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-sidebar-foreground/70" aria-hidden="true" />
        <select
          aria-label={t('context.client')}
          value={activeContext?.tenantId ?? ''}
          onChange={(event) => auth.selectScope?.({ tenantId: event.target.value })}
          className="h-10 w-full appearance-none truncate rounded-md border border-sidebar-border bg-sidebar-background py-2 pl-8 pr-8 text-sm font-medium text-sidebar-foreground"
        >
          {contexts.map((context) => <option key={context.tenantId} value={context.tenantId}>{context.tenantName}</option>)}
        </select>
        <ChevronsUpDown className="pointer-events-none absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2 text-sidebar-foreground/60" aria-hidden="true" />
      </div>
      {activeContext?.workspaces.length ? (
        <div className="relative group-data-[collapsible=icon]:hidden">
          <PanelsTopLeft className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-sidebar-foreground/70" aria-hidden="true" />
          <select
            aria-label={t('context.workspace')}
            value={activeWorkspace?.id ?? ''}
            onChange={(event) => auth.selectScope?.({ tenantId: activeContext.tenantId, workspaceId: event.target.value })}
            className="h-10 w-full appearance-none truncate rounded-md border border-sidebar-border bg-sidebar-background py-2 pl-8 pr-8 text-sm text-sidebar-foreground"
          >
            {activeContext.workspaces.filter((workspace) => workspace.status === 'ACTIVE').map((workspace) => <option key={workspace.id} value={workspace.id}>{workspace.name}</option>)}
          </select>
          <ChevronsUpDown className="pointer-events-none absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2 text-sidebar-foreground/60" aria-hidden="true" />
        </div>
      ) : null}
      <div className="hidden size-8 items-center justify-center rounded-md bg-sidebar-accent text-sidebar-accent-foreground group-data-[collapsible=icon]:flex" title={activeWorkspace?.name ?? activeContext?.tenantName}>
        {activeWorkspace ? <PanelsTopLeft className="size-4" aria-hidden="true" /> : <Building2 className="size-4" aria-hidden="true" />}
      </div>
    </div>
  );
}
