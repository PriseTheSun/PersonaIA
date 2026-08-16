import { ClipboardList, Link2, LockKeyhole, MoreHorizontal, Pencil, Plus, ScanFace, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { z } from 'zod';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { CreationDialog } from '@/components/shared/creation-dialog';
import { DataRegion } from '@/components/shared/data-region';
import { InlineForm } from '@/components/shared/inline-form';
import { PageHeader } from '@/components/shared/page-header';
import { ScopeSelector } from '@/components/shared/scope-selector';
import { SearchField } from '@/components/shared/search-field';
import { EmptyState, ErrorState, LoadingRows } from '@/components/shared/states';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useAuth } from '@/features/auth/auth-store';
import { AssetForm } from '@/features/forms/asset-form';
import { useActiveScope } from '@/hooks/use-active-scope';
import { useApiQuery } from '@/hooks/use-api-query';
import { apiRequest, apiVoid, csrfHeaders } from '@/lib/api';
import { paginatedSchema, personaSchema, questionnaireSchema, workspaceSchema, type Persona, type Questionnaire, type Workspace } from '@/lib/schemas';

type AssetKind = 'personas' | 'questionnaires';
type Asset = Persona | Questionnaire;
const workspaceResponseSchema = z.union([z.array(workspaceSchema), paginatedSchema(workspaceSchema)]).transform((value) => Array.isArray(value) ? value : value.items);

export function AssetsPage({ kind }: { kind: AssetKind }) {
  const { t } = useTranslation();
  const auth = useAuth();
  const { tenantId, workspaceId } = useActiveScope();
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [associatingId, setAssociatingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const activeWorkspace = auth.activeContext?.workspaces.find((workspace) => workspace.id === workspaceId);
  const feature = kind === 'personas' ? 'PERSONA' : 'RESEARCH';
  const featurePermission = activeWorkspace?.permissions.find((permission) => permission.feature === feature);
  const isTenantAdmin = ['SUPER_ADMIN', 'CLIENT_ADMIN'].includes(auth.effectiveRole ?? '');
  const hasFeatureAccess = isTenantAdmin || auth.effectiveRole === 'WORKSPACE_ADMIN' || (featurePermission?.effect === 'ALLOW');
  const canWrite = isTenantAdmin || auth.effectiveRole === 'WORKSPACE_ADMIN' || (featurePermission?.effect === 'ALLOW' && ['WRITE', 'ADMIN'].includes(featurePermission.level));
  const canAssociate = isTenantAdmin || auth.effectiveRole === 'WORKSPACE_ADMIN';
  const canDelete = isTenantAdmin;
  const responseSchema = useMemo(() => z.union([z.array(kind === 'personas' ? personaSchema : questionnaireSchema), paginatedSchema(kind === 'personas' ? personaSchema : questionnaireSchema)]).transform((value) => Array.isArray(value) ? value : value.items), [kind]);
  const query = useApiQuery((signal) => tenantId && hasFeatureAccess && (isTenantAdmin || workspaceId) ? apiRequest(`/tenants/${encodeURIComponent(tenantId)}/${kind}${workspaceId ? `?workspaceId=${encodeURIComponent(workspaceId)}` : ''}`, responseSchema, { signal }) : Promise.resolve([] as Asset[]), [tenantId, workspaceId, kind, hasFeatureAccess, isTenantAdmin]);
  const currentContext = auth.activeContext;
  const scopedWorkspaces = currentContext && currentContext.tenantId === tenantId ? currentContext.workspaces.filter((workspace) => workspace.id === workspaceId && (!canAssociate || workspace.role === 'WORKSPACE_ADMIN')) : [];
  const workspacesQuery = useApiQuery((signal) => !tenantId ? Promise.resolve([]) : isTenantAdmin ? apiRequest(`/tenants/${encodeURIComponent(tenantId)}/workspaces`, workspaceResponseSchema, { signal }) : Promise.resolve(scopedWorkspaces.map((workspace) => workspaceSchema.parse({ id: workspace.id, tenantId, name: workspace.name, status: workspace.status === 'ACTIVE' ? 'ACTIVE' : 'SUSPENDED' }))), [tenantId, isTenantAdmin, canAssociate, scopedWorkspaces.map((workspace) => workspace.id).join('|')]);
  const items = useMemo(() => query.status === 'success' ? (query.data as Asset[]).filter((asset) => {
    const workspaceIds = getWorkspaceIds(asset);
    return (!workspaceId || workspaceIds.includes(workspaceId)) && `${asset.name} ${asset.description ?? ''}`.toLowerCase().includes(search.toLowerCase());
  }) : [], [query, search, workspaceId]);
  const editing = items.find((asset) => asset.id === editingId);
  const labelKey = kind === 'personas' ? 'personas' : 'questionnaires';

  useEffect(() => { document.title = `${t(`${labelKey}.title`)} · ${t('common.appName')}`; }, [labelKey, t]);

  const remove = async (asset: Asset) => {
    if (!tenantId) return;
    setDeletingId(asset.id);
    try {
      await apiVoid(`/tenants/${encodeURIComponent(tenantId)}/${kind}/${encodeURIComponent(asset.id)}`, { method: 'DELETE', headers: csrfHeaders() });
      toast.success(t(`${labelKey}.deleted`));
      query.retry();
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : t('forms.error'));
    } finally {
      setDeletingId(null);
    }
  };

  const Icon = kind === 'personas' ? ScanFace : ClipboardList;
  return (
    <div className="space-y-6">
      <PageHeader title={t(`${labelKey}.title`)} description={t(`${labelKey}.description`)} action={<CreationDialog open={creating} onOpenChange={(open) => { setCreating(open); if (open) setEditingId(null); }} title={t(`${labelKey}.createTitle`)} description={t(`${labelKey}.createDescription`)} trigger={<Button disabled={!tenantId || !canWrite}><Plus />{t(`${labelKey}.create`)}</Button>}>{tenantId ? <AssetForm path={`/tenants/${encodeURIComponent(tenantId)}/${kind}`} extraBody={{ workspaceIds: workspaceId ? [workspaceId] : [] }} submitLabel={t(`${labelKey}.create`)} onCancel={() => setCreating(false)} onSaved={() => { setCreating(false); toast.success(t('forms.created')); query.retry(); }} /> : null}</CreationDialog>} />
      <ScopeSelector />
      {editing && tenantId ? <InlineForm title={t(`${labelKey}.editTitle`, { name: editing.name })} description={t(`${labelKey}.editDescription`)} onClose={() => setEditingId(null)}><AssetForm path={`/tenants/${encodeURIComponent(tenantId)}/${kind}/${encodeURIComponent(editing.id)}`} initial={{ name: editing.name, description: editing.description ?? '' }} submitLabel={t('common.save')} onCancel={() => setEditingId(null)} onSaved={() => { setEditingId(null); toast.success(t(`${labelKey}.updated`)); query.retry(); }} /></InlineForm> : null}
      <DataRegion toolbar={<SearchField value={search} onChange={setSearch} placeholder={t(`${labelKey}.search`)} />}>
        {!tenantId ? <EmptyState title={t('context.selectClient')} description={t('context.selectClientDescription')} /> : !isTenantAdmin && !workspaceId ? <EmptyState title={t('context.selectWorkspace')} description={t('context.selectWorkspaceDescription')} /> : !hasFeatureAccess ? <EmptyState title={t('common.accessDenied')} description={t('forbidden.description')} /> : query.status === 'loading' || workspacesQuery.status === 'loading' ? <LoadingRows /> : query.status === 'error' ? <ErrorState onRetry={query.retry} /> : workspacesQuery.status === 'error' ? <ErrorState onRetry={workspacesQuery.retry} /> : items.length === 0 ? <EmptyState title={search ? t('common.noResults') : t(`${labelKey}.empty`)} description={t(workspaceId ? `${labelKey}.emptyWorkspaceDescription` : `${labelKey}.emptyDescription`)} /> : <ul className="divide-y">{items.map((asset) => <li key={asset.id}>
          <div className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:px-5"><span className="grid size-10 shrink-0 place-items-center rounded-md bg-secondary text-secondary-foreground"><Icon className="size-5" aria-hidden="true" /></span><div className="min-w-0 flex-1"><h2 className="truncate text-sm font-semibold">{asset.name}</h2><p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{asset.description || t(`${labelKey}.noDescription`)}</p><div className="mt-2 flex flex-wrap gap-1.5">{getWorkspaceNames(asset, workspacesQuery.data).map((name) => <span key={name} className="rounded-full bg-muted px-2 py-1 text-xs text-muted-foreground">{name}</span>)}{getWorkspaceIds(asset).length === 0 ? <span className="text-xs text-muted-foreground">{t(`${labelKey}.notAssociated`)}</span> : null}</div></div>{asset.activeProjectUsageCount > 0 ? <span className="flex items-center gap-1 text-xs text-muted-foreground"><LockKeyhole className="size-3.5" />{t(`${labelKey}.inUse`, { count: asset.activeProjectUsageCount })}</span> : null}<DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" aria-label={`${t('common.actions')}: ${asset.name}`}><MoreHorizontal /></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem disabled={!canWrite} onSelect={() => { setEditingId(asset.id); setCreating(false); }}><Pencil />{t('common.edit')}</DropdownMenuItem><DropdownMenuItem disabled={!canAssociate} onSelect={() => setAssociatingId(associatingId === asset.id ? null : asset.id)}><Link2 />{t(`${labelKey}.manageAssociations`)}</DropdownMenuItem><DropdownMenuSeparator /><ConfirmDialog title={t(`${labelKey}.deleteTitle`, { name: asset.name })} description={asset.activeProjectUsageCount > 0 ? t(`${labelKey}.deleteBlocked`) : t(`${labelKey}.deleteDescription`)} confirmLabel={t('common.delete')} destructive loading={deletingId === asset.id} onConfirm={() => void remove(asset)} trigger={<DropdownMenuItem disabled={!canDelete || asset.activeProjectUsageCount > 0} onSelect={(event) => event.preventDefault()} className="text-destructive"><Trash2 />{t('common.delete')}</DropdownMenuItem>} /></DropdownMenuContent></DropdownMenu></div>
          {associatingId === asset.id ? <AssociationEditor tenantId={tenantId} kind={kind} asset={asset} workspaces={workspacesQuery.data} canReplaceAll={isTenantAdmin} onClose={() => setAssociatingId(null)} onSaved={() => { setAssociatingId(null); query.retry(); }} /> : null}
        </li>)}</ul>}
      </DataRegion>
    </div>
  );
}

function getWorkspaceIds(asset: Asset) {
  return Array.from(new Set([...asset.workspaceIds, ...asset.workspaces.map((workspace) => workspace.id)]));
}

function getWorkspaceNames(asset: Asset, workspaces: Workspace[]) {
  const ids = getWorkspaceIds(asset);
  return ids.map((id) => asset.workspaces.find((workspace) => workspace.id === id)?.name ?? workspaces.find((workspace) => workspace.id === id)?.name).filter((name): name is string => Boolean(name));
}

function AssociationEditor({ tenantId, kind, asset, workspaces, canReplaceAll, onClose, onSaved }: { tenantId: string; kind: AssetKind; asset: Asset; workspaces: Workspace[]; canReplaceAll: boolean; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation();
  const initial = getWorkspaceIds(asset);
  const [selected, setSelected] = useState(initial);
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    try {
      const basePath = `/tenants/${encodeURIComponent(tenantId)}/${kind}/${encodeURIComponent(asset.id)}/workspaces`;
      if (canReplaceAll) {
        await apiRequest(basePath, z.unknown(), { method: 'PUT', headers: csrfHeaders(), body: { workspaceIds: selected } });
      } else {
        const [workspace] = workspaces;
        if (workspace && selected.includes(workspace.id) !== initial.includes(workspace.id)) {
          if (selected.includes(workspace.id)) await apiRequest(`${basePath}/${encodeURIComponent(workspace.id)}`, z.unknown(), { method: 'POST', headers: csrfHeaders() });
          else await apiVoid(`${basePath}/${encodeURIComponent(workspace.id)}`, { method: 'DELETE', headers: csrfHeaders() });
        }
      }
      toast.success(t('assets.associationsSaved'));
      onSaved();
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : t('forms.error'));
    } finally {
      setSaving(false);
    }
  };
  return <section className="border-t bg-muted/50 px-4 py-4 sm:px-5" aria-labelledby={`association-${asset.id}`}><h3 id={`association-${asset.id}`} className="text-sm font-semibold">{t('assets.associateTitle', { name: asset.name })}</h3><p className="mt-1 text-xs leading-5 text-muted-foreground">{t('assets.associateDescription')}</p><div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{workspaces.filter((workspace) => workspace.status === 'ACTIVE').map((workspace) => <label key={workspace.id} className="flex min-h-10 cursor-pointer items-center gap-2 rounded-md bg-card px-3 py-2 text-sm"><Checkbox checked={selected.includes(workspace.id)} onChange={(event) => setSelected((current) => event.target.checked ? [...current, workspace.id] : current.filter((id) => id !== workspace.id))} /><span className="truncate">{workspace.name}</span></label>)}</div><div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button variant="outline" onClick={onClose}>{t('common.cancel')}</Button><Button loading={saving} onClick={() => void save()}>{t('common.save')}</Button></div></section>;
}
