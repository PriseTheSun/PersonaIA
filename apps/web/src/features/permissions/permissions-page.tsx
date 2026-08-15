import { Check, UserRound } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { z } from 'zod';
import { Avatar } from '@/components/shared/avatar';
import { DataRegion } from '@/components/shared/data-region';
import { EmptyState, ErrorState, LoadingRows } from '@/components/shared/states';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { apiRequest, csrfHeaders } from '@/lib/api';
import { paginatedSchema, permissionSchema, type Permission, projectMemberSchema, projectSchema } from '@/lib/schemas';
import { useApiQuery } from '@/hooks/use-api-query';
import { cn } from '@/lib/utils';

const projectResponseSchema = z.union([z.array(projectSchema), paginatedSchema(projectSchema)]).transform((value) => Array.isArray(value) ? value : value.items);
const memberResponseSchema = z.union([z.array(projectMemberSchema), paginatedSchema(projectMemberSchema)]).transform((value) => Array.isArray(value) ? value : value.items);
const permissions = permissionSchema.options;

function MemberPermissions({ member, projectId }: { member: z.infer<typeof projectMemberSchema>; projectId: string }) {
  const { t } = useTranslation();
  const [selected, setSelected] = useState<Permission>(member.permissions.at(-1) ?? 'VIEWER');
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const save = async () => {
    setState('saving');
    try {
      await apiRequest(`/projects/${encodeURIComponent(projectId)}/members/${encodeURIComponent(member.user.id)}/permissions`, z.unknown(), { method: 'PATCH', headers: csrfHeaders(), body: { permissions: [selected] } });
      setState('saved');
    } catch { setState('error'); }
  };
  return (
    <article className="px-4 py-5 sm:px-5">
      <div className="flex items-center gap-3"><Avatar name={member.user.name} /><div className="min-w-0"><h2 className="truncate text-sm font-semibold">{member.user.name}</h2><p className="truncate text-xs text-muted-foreground">{member.user.email}</p></div></div>
      <fieldset className="mt-4"><legend className="sr-only">{t('common.permissions')}: {member.user.name}</legend><div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">{permissions.map((permission) => {
        const checked = selected === permission;
        return <label key={permission} className={cn('flex min-h-16 cursor-pointer items-start gap-3 rounded-md border p-3 transition-colors', checked ? 'border-primary bg-secondary' : 'hover:bg-muted/50')}><input className="sr-only" type="radio" name={`permission-${member.user.id}`} value={permission} checked={checked} onChange={() => { setSelected(permission); setState('idle'); }} /><span className={cn('mt-0.5 grid size-4 shrink-0 place-items-center rounded-full border', checked && 'border-primary bg-primary text-primary-foreground')}>{checked ? <Check className="size-3" /> : null}</span><span><span className="block text-sm font-medium">{t(`permissions.permission.${permission}`)}</span><span className="mt-0.5 block text-xs leading-5 text-muted-foreground">{t(`permissions.permissionHint.${permission}`)}</span></span></label>;
      })}</div></fieldset>
      <div className="mt-4 flex flex-wrap items-center justify-end gap-3">{state === 'saved' ? <p className="text-sm text-emerald-800 dark:text-emerald-200" role="status">{t('permissions.saved')}</p> : null}{state === 'error' ? <p className="text-sm text-destructive" role="alert">{t('permissions.saveError')}</p> : null}<Button size="sm" onClick={() => void save()} loading={state === 'saving'}>{t('common.save')}</Button></div>
    </article>
  );
}

export function PermissionsPage() {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  const projectsQuery = useApiQuery((signal) => apiRequest('/projects', projectResponseSchema, { signal }));
  const selectedId = params.get('project') ?? '';
  const normalizedProjectId = useMemo(() => projectsQuery.status === 'success' && projectsQuery.data.some((item) => item.id === selectedId) ? selectedId : '', [projectsQuery, selectedId]);
  const membersQuery = useApiQuery((signal) => normalizedProjectId ? apiRequest(`/projects/${encodeURIComponent(normalizedProjectId)}/members`, memberResponseSchema, { signal }) : Promise.resolve([]), [normalizedProjectId]);
  const members = membersQuery.status === 'success' ? membersQuery.data : [];
  useEffect(() => { document.title = `${t('permissions.title')} · ${t('common.appName')}`; }, [t]);
  return (
    <div className="space-y-6">
      <PageHeader title={t('permissions.title')} description={t('permissions.description')} />
      <div className="max-w-md space-y-2"><label htmlFor="project" className="text-sm font-medium">{t('permissions.selectProject')}</label><select id="project" value={normalizedProjectId} onChange={(event) => setParams(event.target.value ? { project: event.target.value } : {})} className="h-10 w-full rounded-md border border-input bg-background px-3 text-base md:text-sm"><option value="">{t('permissions.selectProject')}</option>{projectsQuery.status === 'success' ? projectsQuery.data.map((project) => <option key={project.id} value={project.id}>{project.name}</option>) : null}</select></div>
      <DataRegion>
        {projectsQuery.status === 'loading' || (normalizedProjectId && membersQuery.status === 'loading') ? <LoadingRows /> : projectsQuery.status === 'error' ? <ErrorState onRetry={projectsQuery.retry} /> : !normalizedProjectId ? <EmptyState title={t('permissions.selectProject')} description={t('permissions.selectProjectHint')} action={<UserRound className="size-5 text-muted-foreground" />} /> : membersQuery.status === 'error' ? <ErrorState onRetry={membersQuery.retry} /> : members.length === 0 ? <EmptyState title={t('permissions.noMembers')} description={t('permissions.noMembersDescription')} /> : <div className="divide-y">{members.map((member) => <MemberPermissions key={member.user.id} member={member} projectId={normalizedProjectId} />)}</div>}
      </DataRegion>
    </div>
  );
}
