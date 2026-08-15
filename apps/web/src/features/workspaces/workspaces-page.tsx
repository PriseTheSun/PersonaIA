import { ArrowRight, MoreHorizontal, PanelsTopLeft, Plus, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { z } from 'zod';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { DataRegion } from '@/components/shared/data-region';
import { InlineForm } from '@/components/shared/inline-form';
import { PageHeader } from '@/components/shared/page-header';
import { ScopeSelector } from '@/components/shared/scope-selector';
import { SearchField } from '@/components/shared/search-field';
import { EmptyState, ErrorState, LoadingRows } from '@/components/shared/states';
import { StatusBadge } from '@/components/shared/status-badge';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { CreateWorkspaceForm } from '@/features/forms/create-workspace-form';
import { useAuth } from '@/features/auth/auth-store';
import { useActiveScope } from '@/hooks/use-active-scope';
import { useApiQuery } from '@/hooks/use-api-query';
import { apiRequest, apiVoid, csrfHeaders } from '@/lib/api';
import { paginatedSchema, workspaceSchema } from '@/lib/schemas';

const responseSchema = z.union([z.array(workspaceSchema), paginatedSchema(workspaceSchema)]).transform((value) => Array.isArray(value) ? value : value.items);

export function WorkspacesPage() {
  const { t } = useTranslation();
  const auth = useAuth();
  const { tenantId } = useActiveScope();
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const canManage = auth.status === 'authenticated' && ['SUPER_ADMIN', 'CLIENT_ADMIN'].includes(auth.effectiveRole ?? auth.user.role);
  const currentContext = auth.activeContext;
  const scopedWorkspaces = currentContext && currentContext.tenantId === tenantId ? currentContext.workspaces : [];
  const query = useApiQuery((signal) => !tenantId ? Promise.resolve([]) : canManage ? apiRequest(`/tenants/${encodeURIComponent(tenantId)}/workspaces`, responseSchema, { signal }) : Promise.resolve(scopedWorkspaces.map((workspace) => workspaceSchema.parse({ id: workspace.id, tenantId, name: workspace.name, status: workspace.status === 'ACTIVE' ? 'ACTIVE' : 'SUSPENDED' }))), [tenantId, canManage, scopedWorkspaces.map((workspace) => workspace.id).join('|')]);
  const items = useMemo(() => query.status === 'success' ? query.data.filter((workspace) => `${workspace.name} ${workspace.description ?? ''}`.toLowerCase().includes(search.toLowerCase())) : [], [query, search]);

  useEffect(() => { document.title = `${t('workspaces.title')} · ${t('common.appName')}`; }, [t]);

  const remove = async (workspaceId: string) => {
    if (!tenantId) return;
    setDeletingId(workspaceId);
    try {
      await apiVoid(`/tenants/${encodeURIComponent(tenantId)}/workspaces/${encodeURIComponent(workspaceId)}`, { method: 'DELETE', headers: csrfHeaders() });
      toast.success(t('workspaces.deleted'));
      query.retry();
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : t('forms.error'));
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title={t('workspaces.title')} description={t('workspaces.description')} action={canManage ? <Button onClick={() => setCreating(true)} disabled={!tenantId}><Plus />{t('workspaces.create')}</Button> : undefined} />
      <ScopeSelector includeWorkspace={false} />
      {creating && tenantId ? <InlineForm title={t('forms.createWorkspaceTitle')} description={t('forms.createWorkspaceDescription')} onClose={() => setCreating(false)}><CreateWorkspaceForm tenantId={tenantId} onCancel={() => setCreating(false)} onCreated={() => { setCreating(false); toast.success(t('forms.created')); query.retry(); }} /></InlineForm> : null}
      <DataRegion toolbar={<SearchField value={search} onChange={setSearch} placeholder={t('workspaces.search')} />}>
        {!tenantId ? <EmptyState title={t('context.selectClient')} description={t('context.selectClientDescription')} /> : query.status === 'loading' ? <LoadingRows /> : query.status === 'error' ? <ErrorState onRetry={query.retry} /> : items.length === 0 ? <EmptyState title={search ? t('common.noResults') : t('workspaces.empty')} description={t('workspaces.emptyDescription')} /> : (
          <ul className="divide-y">{items.map((workspace) => <li key={workspace.id} className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:px-5">
            <span className="grid size-10 shrink-0 place-items-center rounded-md bg-secondary text-secondary-foreground"><PanelsTopLeft className="size-5" aria-hidden="true" /></span>
            <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h2 className="truncate text-sm font-semibold">{workspace.name}</h2><StatusBadge status={workspace.status} />{workspace.isDefault ? <span className="text-xs text-muted-foreground">{t('workspaces.default')}</span> : null}</div><p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{workspace.description || t('workspaces.noDescription')}</p></div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground"><span>{t('workspaces.projectCount', { count: workspace.projectCount })}</span><span>{t('workspaces.memberCount', { count: workspace.memberCount })}</span></div>
            <div className="flex items-center justify-end gap-1"><Button asChild variant="ghost" size="sm"><Link to={`/projects?tenant=${encodeURIComponent(tenantId)}&workspace=${encodeURIComponent(workspace.id)}`}>{t('workspaces.open')}<ArrowRight /></Link></Button>{canManage && !workspace.isDefault ? <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" aria-label={`${t('common.actions')}: ${workspace.name}`}><MoreHorizontal /></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><ConfirmDialog title={t('workspaces.deleteTitle', { name: workspace.name })} description={t('workspaces.deleteDescription')} confirmLabel={t('common.delete')} destructive loading={deletingId === workspace.id} onConfirm={() => void remove(workspace.id)} trigger={<DropdownMenuItem onSelect={(event) => event.preventDefault()} className="text-destructive"><Trash2 />{t('common.delete')}</DropdownMenuItem>} /></DropdownMenuContent></DropdownMenu> : null}</div>
          </li>)}</ul>
        )}
      </DataRegion>
    </div>
  );
}
