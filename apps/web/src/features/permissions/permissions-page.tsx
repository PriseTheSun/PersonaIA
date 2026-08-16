import { Info, KeyRound, ShieldAlert } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { z } from 'zod';
import { Avatar } from '@/components/shared/avatar';
import { DataRegion } from '@/components/shared/data-region';
import { PageHeader } from '@/components/shared/page-header';
import { ScopeSelector } from '@/components/shared/scope-selector';
import { EmptyState, ErrorState, LoadingRows } from '@/components/shared/states';
import { Button } from '@/components/ui/button';
import { useActiveScope } from '@/hooks/use-active-scope';
import { useApiQuery } from '@/hooks/use-api-query';
import { apiRequest, csrfHeaders } from '@/lib/api';
import { accessLevelSchema, featureSchema, functionalPermissionSchema, paginatedSchema, projectSchema, userSchema, type AccessLevel, type FunctionalFeature, type FunctionalPermission } from '@/lib/schemas';
import { cn } from '@/lib/utils';

const projectResponseSchema = z.union([z.array(projectSchema), paginatedSchema(projectSchema)]).transform((value) => Array.isArray(value) ? value : value.items);
const permissionSubjectSchema = z.object({
  userId: z.string().optional(),
  user: userSchema,
  permissions: z.array(functionalPermissionSchema).default([]),
  effectivePermissions: z.array(functionalPermissionSchema).default([]),
  workspacePermissions: z.array(functionalPermissionSchema).optional(),
}).transform((member) => ({ ...member, permissions: member.workspacePermissions ?? member.permissions, effectivePermissions: member.effectivePermissions.length ? member.effectivePermissions : (member.workspacePermissions ?? member.permissions) }));
const memberResponseSchema = z.union([z.array(permissionSubjectSchema), paginatedSchema(permissionSubjectSchema)]).transform((value) => Array.isArray(value) ? value : value.items);

type DraftEffect = 'INHERIT' | 'ALLOW' | 'DENY';
type DraftPermission = { feature: FunctionalFeature; level: AccessLevel; effect: DraftEffect };

export function PermissionsPage() {
  const { t } = useTranslation();
  const { tenantId, workspaceId } = useActiveScope();
  const [params, setParams] = useSearchParams();
  const selectedProjectId = params.get('project') ?? '';
  const selectedUserId = params.get('user') ?? '';
  const projectsQuery = useApiQuery((signal) => tenantId ? apiRequest(`/projects?${workspaceId ? `workspaceId=${encodeURIComponent(workspaceId)}` : `tenantId=${encodeURIComponent(tenantId)}`}`, projectResponseSchema, { signal }) : Promise.resolve([]), [tenantId, workspaceId]);
  const selectedProject = projectsQuery.status === 'success' ? projectsQuery.data.find((project) => project.id === selectedProjectId) : undefined;
  const membersPath = selectedProjectId ? `/projects/${encodeURIComponent(selectedProjectId)}/members` : workspaceId ? `/workspaces/${encodeURIComponent(workspaceId)}/members` : '';
  const membersQuery = useApiQuery((signal) => membersPath ? apiRequest(membersPath, memberResponseSchema, { signal }) : Promise.resolve([]), [membersPath]);
  const selectedMember = membersQuery.status === 'success' ? membersQuery.data.find((member) => member.user.id === selectedUserId) : undefined;

  useEffect(() => { document.title = `${t('permissions.title')} · ${t('common.appName')}`; }, [t]);

  const setParam = (key: 'project' | 'user', value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value); else next.delete(key);
    if (key === 'project') next.delete('user');
    setParams(next, { replace: true });
  };

  return (
    <div className="space-y-6">
      <PageHeader title={t('permissions.functionalTitle')} description={t('permissions.functionalDescription')} />
      <ScopeSelector />
      <section className="grid gap-4 rounded-lg border bg-card p-4 sm:grid-cols-2" aria-label={t('permissions.scopeTitle')}>
        <div className="space-y-2"><label htmlFor="permission-project" className="text-sm font-medium">{t('permissions.scope')}</label><select id="permission-project" value={selectedProjectId} onChange={(event) => setParam('project', event.target.value)} disabled={!tenantId || projectsQuery.status !== 'success'} className="h-10 w-full rounded-md border border-input bg-card px-3 text-base disabled:opacity-60 md:text-sm"><option value="">{t(workspaceId ? 'permissions.workspaceDefaults' : 'forms.selectProject')}</option>{projectsQuery.status === 'success' ? projectsQuery.data.map((project) => <option key={project.id} value={project.id}>{t('permissions.projectOverride', { name: project.name })}</option>) : null}</select></div>
        <div className="space-y-2"><label htmlFor="permission-user" className="text-sm font-medium">{t('permissions.user')}</label><select id="permission-user" value={selectedUserId} onChange={(event) => setParam('user', event.target.value)} disabled={!membersPath || membersQuery.status !== 'success'} className="h-10 w-full rounded-md border border-input bg-card px-3 text-base disabled:opacity-60 md:text-sm"><option value="">{t('permissions.selectUser')}</option>{membersQuery.status === 'success' ? membersQuery.data.map((member) => <option key={member.user.id} value={member.user.id}>{member.user.name} · {member.user.email}</option>) : null}</select></div>
      </section>
      <div className="flex gap-2 rounded-lg bg-muted p-3 text-sm leading-6"><ShieldAlert className="mt-1 size-4 shrink-0" aria-hidden="true" /><p>{t('permissions.denyPriority')}</p></div>
      <DataRegion>
        {!tenantId ? <EmptyState title={t('context.selectClient')} description={t('context.selectClientDescription')} /> : !workspaceId && !selectedProjectId ? <EmptyState title={t('permissions.selectProject')} description={t('permissions.selectProjectHint')} /> : projectsQuery.status === 'loading' || membersQuery.status === 'loading' ? <LoadingRows /> : projectsQuery.status === 'error' ? <ErrorState onRetry={projectsQuery.retry} /> : membersQuery.status === 'error' ? <ErrorState onRetry={membersQuery.retry} /> : membersQuery.data.length === 0 ? <EmptyState title={t('permissions.noMembers')} description={t('permissions.noMembersDescription')} /> : !selectedMember ? <EmptyState title={t('permissions.selectUser')} description={t('permissions.selectUserHint')} action={<KeyRound className="size-5 text-muted-foreground" />} /> : <PermissionEditor key={`${selectedMember.user.id}:${selectedProjectId}`} member={selectedMember} workspaceId={selectedProject?.workspaceId ?? workspaceId} projectId={selectedProjectId || undefined} />}
      </DataRegion>
    </div>
  );
}

function PermissionEditor({ member, workspaceId, projectId }: { member: z.infer<typeof permissionSubjectSchema>; workspaceId?: string | null; projectId?: string }) {
  const explicitQuery = useApiQuery((signal) => projectId
    ? apiRequest(`/projects/${encodeURIComponent(projectId)}/members/${encodeURIComponent(member.user.id)}/permissions`, z.array(functionalPermissionSchema), { signal })
    : Promise.resolve(member.permissions), [projectId, member.user.id]);
  if (explicitQuery.status === 'loading') return <LoadingRows rows={4} />;
  if (explicitQuery.status === 'error') return <ErrorState onRetry={explicitQuery.retry} />;
  return <PermissionMatrix member={member} workspaceId={workspaceId} projectId={projectId} explicitPermissions={explicitQuery.data} />;
}

function PermissionMatrix({ member, workspaceId, projectId, explicitPermissions }: { member: z.infer<typeof permissionSubjectSchema>; workspaceId?: string | null; projectId?: string; explicitPermissions: FunctionalPermission[] }) {
  const { t } = useTranslation();
  const initial = useMemo(() => featureSchema.options.map((feature): DraftPermission => {
    const explicit = explicitPermissions.find((permission) => permission.feature === feature);
    return { feature, level: explicit?.level ?? 'READ', effect: explicit?.effect ?? (projectId ? 'INHERIT' : 'ALLOW') };
  }), [explicitPermissions, projectId]);
  const [draft, setDraft] = useState(initial);
  const [saving, setSaving] = useState(false);

  const update = (feature: FunctionalFeature, patch: Partial<DraftPermission>) => setDraft((current) => current.map((permission) => permission.feature === feature ? { ...permission, ...patch } : permission));
  const save = async () => {
    setSaving(true);
    const permissions: FunctionalPermission[] = draft.filter((permission) => permission.effect !== 'INHERIT').map((permission) => functionalPermissionSchema.parse(permission));
    if (!projectId && !workspaceId) return;
    const path = projectId ? `/projects/${encodeURIComponent(projectId)}/members/${encodeURIComponent(member.user.id)}/permissions` : `/workspaces/${encodeURIComponent(workspaceId!)}/members/${encodeURIComponent(member.user.id)}/permissions`;
    try {
      await apiRequest(path, z.unknown(), { method: 'PUT', headers: csrfHeaders(), body: { permissions } });
      toast.success(t('permissions.saved'));
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : t('permissions.saveError'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <article className="p-4 sm:p-5">
      <div className="flex items-center gap-3 border-b pb-4"><Avatar name={member.user.name} /><div className="min-w-0"><h2 className="truncate text-sm font-semibold">{member.user.name}</h2><p className="truncate text-xs text-muted-foreground">{member.user.email}</p></div></div>
      <fieldset className="mt-5"><legend className="sr-only">{t('common.permissions')}: {member.user.name}</legend><div className="space-y-3">{draft.map((permission) => {
        const effective = member.permissions.find((item) => item.feature === permission.feature);
        return <div key={permission.feature} className="grid gap-3 rounded-lg bg-muted/60 p-3 sm:grid-cols-[minmax(9rem,1fr)_minmax(8rem,0.8fr)_minmax(8rem,0.8fr)] sm:items-end"><div><p className="text-sm font-semibold">{t(`permissions.features.${permission.feature}.label`)}</p><p className="mt-0.5 text-xs leading-5 text-muted-foreground">{t(`permissions.features.${permission.feature}.description`)}</p>{permission.effect === 'INHERIT' && effective ? <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground"><Info className="size-3" />{t('permissions.effective', { level: t(`permissions.levels.${effective.level}`) })}</p> : null}</div><div className="space-y-1.5"><label htmlFor={`effect-${permission.feature}`} className="text-xs font-medium text-muted-foreground">{t('permissions.effect')}</label><select id={`effect-${permission.feature}`} value={permission.effect} onChange={(event) => update(permission.feature, { effect: event.target.value as DraftEffect })} className={cn('h-10 w-full rounded-md border border-input bg-card px-3 text-base md:text-sm', permission.effect === 'DENY' && 'border-destructive')}><option value="ALLOW">{t('permissions.allow')}</option>{projectId ? <option value="INHERIT">{t(workspaceId ? 'permissions.inherit' : 'permissions.inheritProjectRole')}</option> : null}<option value="DENY">{t('permissions.deny')}</option></select></div><div className="space-y-1.5"><label htmlFor={`level-${permission.feature}`} className="text-xs font-medium text-muted-foreground">{t('permissions.level')}</label><select id={`level-${permission.feature}`} value={permission.level} onChange={(event) => update(permission.feature, { level: accessLevelSchema.parse(event.target.value) })} disabled={permission.effect === 'INHERIT'} className="h-10 w-full rounded-md border border-input bg-card px-3 text-base disabled:opacity-60 md:text-sm">{accessLevelSchema.options.map((level) => <option key={level} value={level}>{t(`permissions.levels.${level}`)}</option>)}</select></div></div>;
      })}</div></fieldset>
      <div className="mt-5 flex justify-end"><Button onClick={() => void save()} loading={saving}>{t('common.save')}</Button></div>
    </article>
  );
}
