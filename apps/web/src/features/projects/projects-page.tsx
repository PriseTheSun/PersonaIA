import { ArrowRight, FolderKanban, Plus, Users } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import { z } from 'zod';
import { DataRegion } from '@/components/shared/data-region';
import { InlineForm } from '@/components/shared/inline-form';
import { ScopeSelector } from '@/components/shared/scope-selector';
import { EmptyState, ErrorState, LoadingRows } from '@/components/shared/states';
import { PageHeader } from '@/components/shared/page-header';
import { SearchField } from '@/components/shared/search-field';
import { StatusBadge } from '@/components/shared/status-badge';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/features/auth/auth-store';
import { CreateProjectForm } from '@/features/forms/create-project-form';
import { useActiveScope } from '@/hooks/use-active-scope';
import { useApiQuery } from '@/hooks/use-api-query';
import { apiRequest } from '@/lib/api';
import { paginatedSchema, projectSchema, workspaceSchema } from '@/lib/schemas';
import { formatDate } from '@/lib/utils';

const responseSchema = z.union([z.array(projectSchema), paginatedSchema(projectSchema)]).transform((value) => Array.isArray(value) ? value : value.items);
const workspacesResponseSchema = z.union([z.array(workspaceSchema), paginatedSchema(workspaceSchema)]).transform((value) => Array.isArray(value) ? value : value.items);

export function ProjectsPage() {
  const { t, i18n } = useTranslation();
  const auth = useAuth();
  const { tenantId, workspaceId } = useActiveScope();
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const query = useApiQuery((signal) => tenantId ? apiRequest(`/projects?${workspaceId ? `workspaceId=${encodeURIComponent(workspaceId)}` : `tenantId=${encodeURIComponent(tenantId)}`}`, responseSchema, { signal }) : Promise.resolve([]), [tenantId, workspaceId]);
  const workspacesQuery = useApiQuery((signal) => tenantId ? apiRequest(`/tenants/${encodeURIComponent(tenantId)}/workspaces`, workspacesResponseSchema, { signal }) : Promise.resolve([]), [tenantId]);
  const items = useMemo(() => query.status === 'success' ? query.data.filter((project) => (!workspaceId || project.workspaceId === undefined || project.workspaceId === workspaceId) && project.name.toLowerCase().includes(search.toLowerCase())) : [], [query, search, workspaceId]);
  const currentWorkspace = auth.activeContext?.workspaces.find((workspace) => workspace.id === workspaceId);
  const personaPermission = currentWorkspace?.permissions.find((permission) => permission.feature === 'PERSONA');
  const isTenantLevelAdmin = ['SUPER_ADMIN', 'CLIENT_ADMIN'].includes(auth.effectiveRole ?? '');
  const canCreate = isTenantLevelAdmin || currentWorkspace?.role === 'WORKSPACE_ADMIN' || (personaPermission?.effect === 'ALLOW' && ['WRITE', 'ADMIN'].includes(personaPermission.level));
  const creatableWorkspaceIds = new Set(auth.activeContext?.workspaces.filter((workspace) => workspace.role === 'WORKSPACE_ADMIN' || workspace.permissions.some((permission) => permission.feature === 'PERSONA' && permission.effect === 'ALLOW' && ['WRITE', 'ADMIN'].includes(permission.level))).map((workspace) => workspace.id) ?? []);
  const creatableWorkspaces = workspacesQuery.status === 'success' ? workspacesQuery.data.filter((workspace) => isTenantLevelAdmin || creatableWorkspaceIds.has(workspace.id)) : [];

  useEffect(() => { document.title = `${t('projects.title')} · ${t('common.appName')}`; }, [t]);
  return (
    <div className="space-y-6">
      <PageHeader title={t('projects.title')} description={t('projects.description')} action={<Button onClick={() => setCreating(true)} disabled={!tenantId || !canCreate || workspacesQuery.status !== 'success' || creatableWorkspaces.length === 0}><Plus />{t('projects.create')}</Button>} />
      <ScopeSelector />
      {creating && workspacesQuery.status === 'success' ? <InlineForm title={t('forms.createProjectTitle')} description={t('forms.createProjectDescription')} onClose={() => setCreating(false)}><CreateProjectForm workspaces={creatableWorkspaces} defaultWorkspaceId={workspaceId} onCancel={() => setCreating(false)} onCreated={() => { setCreating(false); toast.success(t('forms.created')); query.retry(); }} /></InlineForm> : null}
      <DataRegion toolbar={<SearchField value={search} onChange={setSearch} placeholder={t('projects.search')} />}>
        {!tenantId ? <EmptyState title={t('context.selectClient')} description={t('context.selectClientDescription')} /> : query.status === 'loading' ? <LoadingRows /> : query.status === 'error' ? <ErrorState onRetry={query.retry} /> : items.length === 0 ? <EmptyState title={search ? t('common.noResults') : t('projects.empty')} description={t('projects.emptyDescription')} /> : (
          <ul className="divide-y">{items.map((project) => (
            <li key={project.id} className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:px-5">
              <span className="grid size-10 shrink-0 place-items-center rounded-md bg-secondary text-secondary-foreground"><FolderKanban className="size-5" aria-hidden="true" /></span>
              <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h2 className="truncate text-sm font-semibold">{project.name}</h2><StatusBadge status={project.status} /></div><p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{project.description || t('projects.noDescription')}</p>{project.workspace?.name ? <p className="mt-1 text-xs text-muted-foreground">{t('projects.inWorkspace', { name: project.workspace.name })}</p> : null}</div>
              <div className="flex items-center justify-between gap-2 sm:justify-end"><span className="flex items-center gap-1.5 text-xs text-muted-foreground"><Users className="size-3.5" aria-hidden="true" />{t('projects.memberCount', { count: project.memberCount })} · {formatDate(project.updatedAt, i18n.language)}</span><Button asChild variant="ghost" size="sm"><Link to={`/permissions?tenant=${encodeURIComponent(tenantId)}&workspace=${encodeURIComponent(project.workspaceId ?? workspaceId ?? '')}&project=${encodeURIComponent(project.id)}`}>{t('projects.open')}<ArrowRight /></Link></Button></div>
            </li>
          ))}</ul>
        )}
      </DataRegion>
    </div>
  );
}
