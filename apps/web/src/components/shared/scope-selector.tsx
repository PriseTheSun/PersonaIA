import { Building2, PanelsTopLeft } from 'lucide-react';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { useAuth } from '@/features/auth/auth-store';
import { useActiveScope } from '@/hooks/use-active-scope';
import { useApiQuery } from '@/hooks/use-api-query';
import { apiRequest } from '@/lib/api';
import { paginatedSchema, tenantSchema, workspaceSchema } from '@/lib/schemas';

const tenantsResponseSchema = z.union([z.array(tenantSchema), paginatedSchema(tenantSchema)]).transform((value) => Array.isArray(value) ? value : value.items);
const workspacesResponseSchema = z.union([z.array(workspaceSchema), paginatedSchema(workspaceSchema)]).transform((value) => Array.isArray(value) ? value : value.items);

export function ScopeSelector({ includeWorkspace = true }: { includeWorkspace?: boolean }) {
  const { t } = useTranslation();
  const auth = useAuth();
  const { tenantId, workspaceId, selectTenant, selectWorkspace } = useActiveScope();
  const isSuperAdmin = auth.status === 'authenticated' && auth.user.role === 'SUPER_ADMIN';
  const currentContext = auth.status === 'authenticated' ? auth.user.contexts?.find((context) => context.tenantId === tenantId) : undefined;
  const canViewAllWorkspaces = isSuperAdmin || currentContext?.clientRole === 'CLIENT_ADMIN';
  const tenantsQuery = useApiQuery((signal) => isSuperAdmin
    ? apiRequest('/tenants', tenantsResponseSchema, { signal })
    : Promise.resolve((auth.status === 'authenticated' ? auth.user.contexts ?? [] : []).map((context) => tenantSchema.parse({ id: context.tenantId, name: context.tenantName, slug: context.tenantSlug ?? context.tenantId, createdAt: new Date(0).toISOString() }))), [isSuperAdmin, auth.status]);
  const scopedWorkspaces = currentContext && currentContext.tenantId === tenantId ? currentContext.workspaces : [];
  const scopedWorkspaceKey = scopedWorkspaces.map((workspace) => `${workspace.id}:${workspace.status}`).join('|');
  const workspacesQuery = useApiQuery((signal) => tenantId && includeWorkspace
    ? canViewAllWorkspaces
      ? apiRequest(`/tenants/${encodeURIComponent(tenantId)}/workspaces`, workspacesResponseSchema, { signal })
      : Promise.resolve(scopedWorkspaces.map((workspace) => workspaceSchema.parse({ id: workspace.id, tenantId, name: workspace.name, status: workspace.status === 'ACTIVE' ? 'ACTIVE' : 'SUSPENDED' })))
    : Promise.resolve([]), [tenantId, includeWorkspace, canViewAllWorkspaces, scopedWorkspaceKey]);

  useEffect(() => {
    if (canViewAllWorkspaces || workspaceId || workspacesQuery.status !== 'success') return;
    const first = workspacesQuery.data.find((workspace) => workspace.status === 'ACTIVE');
    if (first) selectWorkspace(first.id);
  }, [canViewAllWorkspaces, selectWorkspace, workspaceId, workspacesQuery]);

  return (
    <section className="flex flex-col gap-3 rounded-lg bg-muted/60 p-3 sm:flex-row sm:items-end" aria-label={t('context.scope')}>
      <div className="min-w-0 flex-1 space-y-1.5">
        <label htmlFor="scope-tenant" className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground"><Building2 className="size-3.5" aria-hidden="true" />{t('context.client')}</label>
        <select id="scope-tenant" value={tenantId ?? ''} onChange={(event) => selectTenant(event.target.value)} disabled={tenantsQuery.status !== 'success'} className="h-10 w-full rounded-md border border-input bg-card px-3 text-base disabled:opacity-60 md:text-sm">
          <option value="">{t('context.selectClient')}</option>
          {tenantsQuery.status === 'success' ? tenantsQuery.data.filter((tenant) => tenant.status === 'ACTIVE').map((tenant) => <option key={tenant.id} value={tenant.id}>{tenant.name}</option>) : null}
        </select>
      </div>
      {includeWorkspace ? <div className="min-w-0 flex-1 space-y-1.5">
        <label htmlFor="scope-workspace" className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground"><PanelsTopLeft className="size-3.5" aria-hidden="true" />{t('context.workspace')}</label>
        <select id="scope-workspace" value={workspaceId ?? ''} onChange={(event) => selectWorkspace(event.target.value)} disabled={!tenantId || workspacesQuery.status !== 'success'} className="h-10 w-full rounded-md border border-input bg-card px-3 text-base disabled:opacity-60 md:text-sm">
          {canViewAllWorkspaces ? <option value="">{t('context.allWorkspaces')}</option> : null}
          {workspacesQuery.status === 'success' ? workspacesQuery.data.filter((workspace) => workspace.status === 'ACTIVE').map((workspace) => <option key={workspace.id} value={workspace.id}>{workspace.name}</option>) : null}
        </select>
      </div> : null}
    </section>
  );
}
