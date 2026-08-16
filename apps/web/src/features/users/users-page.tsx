import { KeyRound, MoreHorizontal, Plus, UserMinus, UserRoundCog } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { z } from 'zod';
import { Avatar } from '@/components/shared/avatar';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { CreationDialog } from '@/components/shared/creation-dialog';
import { DataRegion } from '@/components/shared/data-region';
import { MutationNotice } from '@/components/shared/inline-form';
import { PageHeader } from '@/components/shared/page-header';
import { ScopeSelector } from '@/components/shared/scope-selector';
import { SearchField } from '@/components/shared/search-field';
import { EmptyState, ErrorState, LoadingRows } from '@/components/shared/states';
import { StatusBadge } from '@/components/shared/status-badge';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Label } from '@/components/ui/label';
import { useActiveScope } from '@/hooks/use-active-scope';
import { useApiQuery } from '@/hooks/use-api-query';
import { apiRequest, apiVoid, csrfHeaders } from '@/lib/api';
import { clientMembershipSchema, paginatedSchema, workspaceMembershipSchema, type ClientMembership, type WorkspaceMembership } from '@/lib/schemas';
import { formatDate } from '@/lib/utils';

const clientResponseSchema = z.union([z.array(clientMembershipSchema), paginatedSchema(clientMembershipSchema)]).transform((value) => Array.isArray(value) ? value : value.items);
const workspaceResponseSchema = z.union([z.array(workspaceMembershipSchema), paginatedSchema(workspaceMembershipSchema)]).transform((value) => Array.isArray(value) ? value : value.items);
type Membership = ClientMembership | WorkspaceMembership;

function isWorkspaceMembership(membership: Membership): membership is WorkspaceMembership {
  return 'workspaceId' in membership;
}

export function UsersPage() {
  const { t, i18n } = useTranslation();
  const { tenantId, workspaceId } = useActiveScope();
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const [mutatingId, setMutatingId] = useState<string | null>(null);
  const query = useApiQuery<Membership[]>(async (signal) => {
    if (!tenantId) return [];
    if (workspaceId) return await apiRequest(`/workspaces/${encodeURIComponent(workspaceId)}/members`, workspaceResponseSchema, { signal });
    return await apiRequest(`/tenants/${encodeURIComponent(tenantId)}/memberships`, clientResponseSchema, { signal });
  }, [tenantId, workspaceId]);
  const candidatesQuery = useApiQuery<ClientMembership[]>((signal) => tenantId && workspaceId ? apiRequest(`/tenants/${encodeURIComponent(tenantId)}/memberships`, clientResponseSchema, { signal }) : Promise.resolve([]), [tenantId, workspaceId]);
  const items = useMemo(() => query.status === 'success' ? query.data.filter((membership) => `${membership.user.name} ${membership.user.email}`.toLowerCase().includes(search.toLowerCase())) : [], [query, search]);

  useEffect(() => { document.title = `${t('users.title')} · ${t('common.appName')}`; }, [t]);

  const update = async (membership: Membership, input: Record<string, string>) => {
    if (!tenantId) return;
    setMutatingId(membership.userId);
    const path = workspaceId ? `/workspaces/${encodeURIComponent(workspaceId)}/members/${encodeURIComponent(membership.userId)}` : `/tenants/${encodeURIComponent(tenantId)}/memberships/${encodeURIComponent(membership.userId)}`;
    try {
      await apiRequest(path, z.unknown(), { method: 'PATCH', headers: csrfHeaders(), body: input });
      toast.success(t('users.updated'));
      query.retry();
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : t('forms.error'));
    } finally {
      setMutatingId(null);
    }
  };

  const remove = async (membership: Membership) => {
    if (!tenantId) return;
    setMutatingId(membership.userId);
    const path = workspaceId ? `/workspaces/${encodeURIComponent(workspaceId)}/members/${encodeURIComponent(membership.userId)}` : `/tenants/${encodeURIComponent(tenantId)}/memberships/${encodeURIComponent(membership.userId)}`;
    try {
      await apiVoid(path, { method: 'DELETE', headers: csrfHeaders() });
      toast.success(t('users.removed'));
      query.retry();
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : t('forms.error'));
    } finally {
      setMutatingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title={t('users.title')} description={t('users.membershipDescription')} action={<CreationDialog open={creating} onOpenChange={setCreating} title={t(workspaceId ? 'users.addWorkspaceTitle' : 'users.addClientTitle')} description={t(workspaceId ? 'users.addWorkspaceDescription' : 'users.addClientDescription')} trigger={<Button disabled={!tenantId || Boolean(workspaceId && candidatesQuery.status !== 'success')}><Plus />{t('users.add')}</Button>}>{tenantId && (!workspaceId || candidatesQuery.status === 'success') ? <MembershipForm tenantId={tenantId} workspaceId={workspaceId} candidates={workspaceId && candidatesQuery.status === 'success' ? candidatesQuery.data.filter((candidate) => candidate.status === 'ACTIVE' && !items.some((membership) => membership.userId === candidate.userId)) : []} onCancel={() => setCreating(false)} onCreated={() => { setCreating(false); toast.success(t('forms.created')); query.retry(); candidatesQuery.retry(); }} /> : null}</CreationDialog>} />
      <ScopeSelector />
      <DataRegion toolbar={<SearchField value={search} onChange={setSearch} placeholder={t('users.search')} />}>
        {!tenantId ? <EmptyState title={t('context.selectClient')} description={t('context.selectClientDescription')} /> : query.status === 'loading' ? <LoadingRows /> : query.status === 'error' ? <ErrorState onRetry={query.retry} /> : items.length === 0 ? <EmptyState title={search ? t('common.noResults') : t('users.empty')} description={t(workspaceId ? 'users.emptyWorkspaceDescription' : 'users.emptyClientDescription')} /> : (
          <ul className="divide-y">{items.map((membership) => <li key={membership.userId} className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:px-5">
            <div className="flex min-w-0 flex-1 items-center gap-3"><Avatar name={membership.user.name} /><div className="min-w-0"><h2 className="truncate text-sm font-medium">{membership.user.name}</h2><p className="truncate text-xs text-muted-foreground">{membership.user.email}</p></div></div>
            <div className="flex flex-wrap items-center gap-2"><span className="text-xs font-medium">{t(`roles.${membership.role}`)}</span><StatusBadge status={membership.status} /></div>
            <div className="text-xs text-muted-foreground">{membership.createdAt ? formatDate(membership.createdAt, i18n.language) : null}</div>
            <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" aria-label={`${t('common.actions')}: ${membership.user.name}`} disabled={mutatingId === membership.userId}><MoreHorizontal /></Button></DropdownMenuTrigger><DropdownMenuContent align="end">{isWorkspaceMembership(membership) ? <><DropdownMenuItem asChild><Link to={`/permissions?tenant=${encodeURIComponent(tenantId)}&workspace=${encodeURIComponent(workspaceId ?? '')}&user=${encodeURIComponent(membership.userId)}`}><KeyRound />{t('users.configurePermissions')}</Link></DropdownMenuItem><DropdownMenuItem onSelect={() => void update(membership, { role: membership.role === 'WORKSPACE_ADMIN' ? 'WORKSPACE_MEMBER' : 'WORKSPACE_ADMIN' })}><UserRoundCog />{t(membership.role === 'WORKSPACE_ADMIN' ? 'users.makeMember' : 'users.makeWorkspaceAdmin')}</DropdownMenuItem></> : <DropdownMenuItem onSelect={() => void update(membership, { role: membership.role === 'CLIENT_ADMIN' ? 'CLIENT_MEMBER' : 'CLIENT_ADMIN' })}><UserRoundCog />{t(membership.role === 'CLIENT_ADMIN' ? 'users.makeMember' : 'users.makeClientAdmin')}</DropdownMenuItem>}<DropdownMenuSeparator /><ConfirmDialog title={t('users.removeTitle', { name: membership.user.name })} description={t('users.removeDescription')} confirmLabel={t('common.remove')} destructive loading={mutatingId === membership.userId} onConfirm={() => void remove(membership)} trigger={<DropdownMenuItem onSelect={(event) => event.preventDefault()} className="text-destructive"><UserMinus />{t('common.remove')}</DropdownMenuItem>} /></DropdownMenuContent></DropdownMenu>
          </li>)}</ul>
        )}
      </DataRegion>
    </div>
  );
}

function MembershipForm({ tenantId, workspaceId, candidates, onCreated, onCancel }: { tenantId: string; workspaceId?: string; candidates: ClientMembership[]; onCreated: () => void; onCancel: () => void }) {
  const { t } = useTranslation();
  const [userIdentifier, setUserIdentifier] = useState('');
  const [role, setRole] = useState(workspaceId ? 'WORKSPACE_MEMBER' : 'CLIENT_MEMBER');
  const [permissions, setPermissions] = useState<Record<'PERSONA' | 'RESEARCH' | 'SIMULATION' | 'DASHBOARD', 'READ' | 'WRITE' | 'ADMIN' | 'DENY'>>({ PERSONA: 'READ', RESEARCH: 'READ', SIMULATION: 'READ', DASHBOARD: 'READ' });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const identifier = userIdentifier.trim();
    const validIdentifier = workspaceId ? z.string().uuid().safeParse(identifier).success : z.string().email().safeParse(identifier).success;
    if (!validIdentifier) { setError(t('forms.validation.user')); return; }
    setError(null);
    setSubmitting(true);
    const path = workspaceId ? `/workspaces/${encodeURIComponent(workspaceId)}/members` : `/tenants/${encodeURIComponent(tenantId)}/memberships`;
    try {
      await apiRequest(path, z.unknown(), { method: 'POST', headers: csrfHeaders(), body: { ...(workspaceId ? { userId: identifier } : { email: identifier }), role, status: 'ACTIVE', ...(workspaceId ? { permissions: Object.entries(permissions).map(([feature, value]) => ({ feature, level: value === 'DENY' ? 'READ' : value, effect: value === 'DENY' ? 'DENY' : 'ALLOW' })) } : {}) } });
      onCreated();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('forms.error'));
    } finally {
      setSubmitting(false);
    }
  };
  return <form onSubmit={(event) => void submit(event)} className="space-y-5"><MutationNotice message={error} type="error" /><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="membership-user">{t(workspaceId ? 'users.selectUser' : 'common.email')}</Label>{workspaceId ? <select id="membership-user" value={userIdentifier} onChange={(event) => setUserIdentifier(event.target.value)} className="h-10 w-full rounded-md border border-input bg-card px-3 text-base md:text-sm" aria-describedby="membership-user-hint"><option value="">{t('users.selectUser')}</option>{candidates.map((candidate) => <option key={candidate.userId} value={candidate.userId}>{candidate.user.name} · {candidate.user.email}</option>)}</select> : <input id="membership-user" type="email" value={userIdentifier} onChange={(event) => setUserIdentifier(event.target.value)} className="h-10 w-full rounded-md border border-input bg-card px-3 text-base md:text-sm" autoComplete="email" aria-describedby="membership-user-hint" />}<p id="membership-user-hint" className="text-xs leading-5 text-muted-foreground">{t(workspaceId ? 'users.selectUserHint' : 'users.emailHint')}</p></div><div className="space-y-2"><Label htmlFor="membership-role">{t('accessControl.role')}</Label><select id="membership-role" value={role} onChange={(event) => setRole(event.target.value)} className="h-10 w-full rounded-md border border-input bg-card px-3 text-base md:text-sm">{workspaceId ? <><option value="WORKSPACE_MEMBER">{t('roles.WORKSPACE_MEMBER')}</option><option value="WORKSPACE_ADMIN">{t('roles.WORKSPACE_ADMIN')}</option></> : <><option value="CLIENT_MEMBER">{t('roles.CLIENT_MEMBER')}</option><option value="CLIENT_ADMIN">{t('roles.CLIENT_ADMIN')}</option></>}</select></div></div>{workspaceId ? <fieldset><legend className="text-sm font-semibold">{t('users.initialPermissions')}</legend><p className="mt-1 text-xs leading-5 text-muted-foreground">{t('users.initialPermissionsDescription')}</p><div className="mt-3 grid gap-3 sm:grid-cols-2">{(['PERSONA', 'RESEARCH', 'SIMULATION', 'DASHBOARD'] as const).map((feature) => <div className="space-y-1.5" key={feature}><label htmlFor={`initial-${feature}`} className="text-xs font-medium">{t(`permissions.features.${feature}.label`)}</label><select id={`initial-${feature}`} value={permissions[feature]} onChange={(event) => setPermissions((current) => ({ ...current, [feature]: event.target.value as typeof permissions[typeof feature] }))} className="h-10 w-full rounded-md border border-input bg-card px-3 text-base md:text-sm"><option value="READ">{t('permissions.levels.READ')}</option><option value="WRITE">{t('permissions.levels.WRITE')}</option><option value="ADMIN">{t('permissions.levels.ADMIN')}</option><option value="DENY">{t('permissions.deny')}</option></select></div>)}</div></fieldset> : null}<div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button type="button" variant="outline" onClick={onCancel}>{t('common.cancel')}</Button><Button type="submit" loading={submitting} disabled={Boolean(workspaceId && candidates.length === 0)}>{t('users.add')}</Button></div></form>;
}
