import { ChevronsUpDown, PanelsTopLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/features/auth/auth-store';

export function OrganizationSwitcher() {
  const { t } = useTranslation();
  const auth = useAuth();
  if (auth.status !== 'authenticated') return null;

  const contexts = (auth.user.contexts ?? []).filter((context) => context.status === 'ACTIVE');
  const activeContext = auth.activeContext ?? contexts.find((context) => context.tenantId === auth.activeScope?.tenantId) ?? contexts[0];
  if (!activeContext) return null;

  if (contexts.length <= 1) {
    return <Badge variant="outline" className="min-w-0 max-w-40 bg-card text-muted-foreground sm:max-w-64"><span className="truncate">{activeContext.tenantName}</span></Badge>;
  }

  return (
    <div className="relative min-w-0 max-w-40 sm:max-w-64">
      <select
        aria-label={t('context.client')}
        value={activeContext.tenantId}
        onChange={(event) => auth.selectScope?.({ tenantId: event.target.value })}
        className="h-7 w-full appearance-none truncate rounded-full border bg-card py-0.5 pl-2.5 pr-7 text-xs font-medium text-muted-foreground"
      >
        {contexts.map((context) => <option key={context.tenantId} value={context.tenantId}>{context.tenantName}</option>)}
      </select>
      <ChevronsUpDown className="pointer-events-none absolute right-2 top-1/2 size-3 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
    </div>
  );
}

export function WorkspaceSwitcher() {
  const { t } = useTranslation();
  const auth = useAuth();
  if (auth.status !== 'authenticated' || !auth.activeContext?.workspaces.length) return null;

  const activeContext = auth.activeContext;
  const activeWorkspaces = activeContext.workspaces.filter((workspace) => workspace.status === 'ACTIVE');
  const activeWorkspace = activeWorkspaces.find((workspace) => workspace.id === auth.activeScope?.workspaceId) ?? activeWorkspaces[0];
  if (!activeWorkspace) return null;

  return (
    <div className="group-data-[collapsible=icon]:space-y-0">
      <div className="relative group-data-[collapsible=icon]:hidden">
        <PanelsTopLeft className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-sidebar-foreground/70" aria-hidden="true" />
        <select
          aria-label={t('context.workspace')}
          value={activeWorkspace.id}
          onChange={(event) => auth.selectScope?.({ tenantId: activeContext.tenantId, workspaceId: event.target.value })}
          className="h-10 w-full appearance-none truncate rounded-md border border-sidebar-border bg-sidebar-background py-2 pl-8 pr-8 text-sm text-sidebar-foreground"
        >
          {activeWorkspaces.map((workspace) => <option key={workspace.id} value={workspace.id}>{workspace.name}</option>)}
        </select>
        <ChevronsUpDown className="pointer-events-none absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2 text-sidebar-foreground/60" aria-hidden="true" />
      </div>
      <div className="hidden size-8 items-center justify-center rounded-md bg-sidebar-accent text-sidebar-accent-foreground group-data-[collapsible=icon]:flex" title={activeWorkspace.name}>
        <PanelsTopLeft className="size-4" aria-hidden="true" />
      </div>
    </div>
  );
}
