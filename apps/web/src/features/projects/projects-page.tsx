import { ArrowRight, FolderInput, MoreHorizontal, Plus } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import { z } from 'zod';
import { CreationDialog } from '@/components/shared/creation-dialog';
import { FormDialog } from '@/components/shared/form-dialog';
import { DataRegion } from '@/components/shared/data-region';
import { ScopeSelector } from '@/components/shared/scope-selector';
import { EmptyState, ErrorState, LoadingRows } from '@/components/shared/states';
import { PageHeader } from '@/components/shared/page-header';
import { SearchField } from '@/components/shared/search-field';
import { StatusBadge } from '@/components/shared/status-badge';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAuth } from '@/features/auth/auth-store';
import { CreateProjectForm } from '@/features/forms/create-project-form';
import { ProjectWorkspaceForm } from '@/features/forms/project-workspace-form';
import { useActiveScope } from '@/hooks/use-active-scope';
import { useApiQuery } from '@/hooks/use-api-query';
import { apiRequest } from '@/lib/api';
import { paginatedSchema, projectSchema, workspaceSchema } from '@/lib/schemas';
import { formatDate } from '@/lib/utils';
import { ProjectAccessCode } from './project-access-code';

const responseSchema = z.union([z.array(projectSchema), paginatedSchema(projectSchema)]).transform((value) => Array.isArray(value) ? value : value.items);
const workspacesResponseSchema = z.union([z.array(workspaceSchema), paginatedSchema(workspaceSchema)]).transform((value) => Array.isArray(value) ? value : value.items);

export function ProjectsPage() {
  const { t, i18n } = useTranslation();
  const auth = useAuth();
  const { tenantId, workspaceId } = useActiveScope();
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const [organizingId, setOrganizingId] = useState<string | null>(null);
  const query = useApiQuery((signal) => tenantId ? apiRequest(`/projects?${workspaceId ? `workspaceId=${encodeURIComponent(workspaceId)}` : `tenantId=${encodeURIComponent(tenantId)}`}`, responseSchema, { signal }) : Promise.resolve([]), [tenantId, workspaceId]);
  const workspacesQuery = useApiQuery((signal) => tenantId ? apiRequest(`/tenants/${encodeURIComponent(tenantId)}/workspaces`, workspacesResponseSchema, { signal }) : Promise.resolve([]), [tenantId]);
  const items = useMemo(() => query.status === 'success' ? query.data.filter((project) => (!workspaceId || project.workspaceId === workspaceId) && project.name.toLowerCase().includes(search.toLowerCase())) : [], [query, search, workspaceId]);
  const currentWorkspace = auth.activeContext?.workspaces.find((workspace) => workspace.id === workspaceId);
  const personaPermission = currentWorkspace?.permissions.find((permission) => permission.feature === 'PERSONA');
  const isTenantLevelAdmin = ['SUPER_ADMIN', 'CLIENT_ADMIN'].includes(auth.effectiveRole ?? '');
  const canCreate = isTenantLevelAdmin || currentWorkspace?.role === 'WORKSPACE_ADMIN' || (personaPermission?.effect === 'ALLOW' && ['WRITE', 'ADMIN'].includes(personaPermission.level));
  const creatableWorkspaceIds = new Set(auth.activeContext?.workspaces.filter((workspace) => workspace.role === 'WORKSPACE_ADMIN' || workspace.permissions.some((permission) => permission.feature === 'PERSONA' && permission.effect === 'ALLOW' && ['WRITE', 'ADMIN'].includes(permission.level))).map((workspace) => workspace.id) ?? []);
  const creatableWorkspaces = workspacesQuery.status === 'success' ? workspacesQuery.data.filter((workspace) => isTenantLevelAdmin || creatableWorkspaceIds.has(workspace.id)) : [];
  const organizingProject = query.status === 'success' ? query.data.find((project) => project.id === organizingId) : undefined;

  useEffect(() => { document.title = `${t('projects.title')} · ${t('common.appName')}`; }, [t]);
  return (
    <div className="space-y-6">
      <PageHeader title={t('projects.title')} description={t('projects.description')} action={<CreationDialog open={creating} onOpenChange={setCreating} title={t('forms.createProjectTitle')} description={t('forms.createProjectDescription')} trigger={<Button disabled={!tenantId || !canCreate || workspacesQuery.status !== 'success'}><Plus />{t('projects.create')}</Button>}>{tenantId && workspacesQuery.status === 'success' ? <CreateProjectForm tenantId={tenantId} workspaces={creatableWorkspaces} defaultWorkspaceId={workspaceId} allowWithoutWorkspace={isTenantLevelAdmin} onCancel={() => setCreating(false)} onCreated={() => { setCreating(false); toast.success(t('forms.created')); query.retry(); }} /> : null}</CreationDialog>} />
      <ScopeSelector />
      {organizingProject && workspacesQuery.status === 'success' ? <FormDialog open onOpenChange={(open) => { if (!open) setOrganizingId(null); }} title={t('projects.organizeTitle', { name: organizingProject.name })} description={t('projects.organizeDescription')}><ProjectWorkspaceForm project={organizingProject} workspaces={workspacesQuery.data} onCancel={() => setOrganizingId(null)} onSaved={() => { setOrganizingId(null); toast.success(t('projects.organized')); query.retry(); workspacesQuery.retry(); }} /></FormDialog> : null}
      <DataRegion toolbar={<SearchField value={search} onChange={setSearch} placeholder={t('projects.search')} />}>
        {!tenantId ? <EmptyState title={t('context.selectClient')} description={t('context.selectClientDescription')} /> : query.status === 'loading' ? <LoadingRows /> : query.status === 'error' ? <ErrorState onRetry={query.retry} /> : items.length === 0 ? <EmptyState title={search ? t('common.noResults') : t('projects.empty')} description={t('projects.emptyDescription')} /> : (
          <Table className="min-w-[880px]">
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-64">{t('projects.columns.name')}</TableHead>
                <TableHead className="min-w-72">{t('projects.columns.code')}</TableHead>
                <TableHead className="whitespace-nowrap text-center">{t('projects.columns.members')}</TableHead>
                <TableHead className="whitespace-nowrap">{t('projects.columns.created')}</TableHead>
                <TableHead className="w-20 text-right">{t('common.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>{items.map((project) => (
              <TableRow key={project.id}>
                <TableCell>
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="truncate font-medium">{project.name}</span>
                    <StatusBadge status={project.status} />
                  </div>
                  <p className="mt-1 max-w-md truncate text-xs text-muted-foreground">{project.description || t('projects.noDescription')}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{project.workspace?.name ? t('projects.inWorkspace', { name: project.workspace.name }) : t('projects.withoutWorkspace')}</p>
                </TableCell>
                <TableCell>{project.accessCode ? <ProjectAccessCode projectId={project.id} initial={project.accessCode} /> : <span className="text-muted-foreground" aria-label={t('common.unknown')}>—</span>}</TableCell>
                <TableCell className="text-center font-medium tabular-nums">{project.memberCount}</TableCell>
                <TableCell className="whitespace-nowrap text-muted-foreground">{formatDate(project.createdAt, i18n.language)}</TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" aria-label={`${t('common.actions')}: ${project.name}`}><MoreHorizontal /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {isTenantLevelAdmin ? <DropdownMenuItem onSelect={() => setOrganizingId(project.id)}><FolderInput />{t('projects.organize')}</DropdownMenuItem> : null}
                      <DropdownMenuItem asChild><Link to={`/permissions?tenant=${encodeURIComponent(tenantId)}&workspace=${encodeURIComponent(project.workspaceId ?? 'all')}&project=${encodeURIComponent(project.id)}`}><ArrowRight />{t('projects.open')}</Link></DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}</TableBody>
          </Table>
        )}
      </DataRegion>
    </div>
  );
}
