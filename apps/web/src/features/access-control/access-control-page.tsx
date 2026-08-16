import { CheckCircle2, ShieldCheck } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { z } from 'zod';
import { DataRegion } from '@/components/shared/data-region';
import { FormDialog } from '@/components/shared/form-dialog';
import { MutationNotice } from '@/components/shared/inline-form';
import { PageHeader } from '@/components/shared/page-header';
import { ScopeSelector } from '@/components/shared/scope-selector';
import { SearchField } from '@/components/shared/search-field';
import { EmptyState, ErrorState, LoadingRows } from '@/components/shared/states';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/features/auth/auth-store';
import { useActiveScope } from '@/hooks/use-active-scope';
import { useApiQuery } from '@/hooks/use-api-query';
import { ApiError, apiRequest, csrfHeaders } from '@/lib/api';
import { clientMembershipSchema, paginatedSchema, platformIdentitySchema, projectSchema, tenantSchema, type ClientMembership, type ClientRole, type MembershipStatus, type PlatformIdentity, type Project, type Tenant } from '@/lib/schemas';
import { ClientAccessTable, PlatformAccessTable } from './access-control-tables';
import { isPendingAccess } from './access-control-utils';

const responseSchema = z.union([z.array(clientMembershipSchema), paginatedSchema(clientMembershipSchema)]).transform((value) => Array.isArray(value) ? value : value.items);
const platformResponseSchema = z.union([z.array(platformIdentitySchema), paginatedSchema(platformIdentitySchema)]).transform((value) => Array.isArray(value) ? value : value.items);
const projectsResponseSchema = z.union([z.array(projectSchema), paginatedSchema(projectSchema)]).transform((value) => Array.isArray(value) ? value : value.items);
const tenantsResponseSchema = z.union([z.array(tenantSchema), paginatedSchema(tenantSchema)]).transform((value) => Array.isArray(value) ? value : value.items);
const filters = ['ALL', 'PENDING', 'ACTIVE', 'SUSPENDED', 'REMOVED'] as const;
type Filter = typeof filters[number];
type EditableStatus = Extract<MembershipStatus, 'ACTIVE' | 'SUSPENDED' | 'REMOVED'>;
type AccessView = 'CLIENT' | 'PLATFORM';

function matchesFilter(status: MembershipStatus, filter: Filter) {
  if (filter === 'ALL') return true;
  if (filter === 'PENDING') return isPendingAccess(status);
  return status === filter;
}

export function AccessControlPage() {
  const { t, i18n } = useTranslation();
  const auth = useAuth();
  const { tenantId } = useActiveScope();
  const isSuperAdmin = auth.status === 'authenticated' && auth.user.role === 'SUPER_ADMIN';
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedView = searchParams.get('view');
  const routeView: AccessView = isSuperAdmin && requestedView !== 'CLIENT' ? 'PLATFORM' : 'CLIENT';
  const [view, setView] = useState<AccessView>(routeView);
  const [search, setSearch] = useState('');
  const requestedFilter = searchParams.get('status');
  const initialFilter = filters.includes(requestedFilter as Filter) ? requestedFilter as Filter : 'PENDING';
  const [filter, setFilter] = useState<Filter>(initialFilter);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [approvalId, setApprovalId] = useState<string | null>(null);
  const [mutatingId, setMutatingId] = useState<string | null>(null);
  const [editingPlatformId, setEditingPlatformId] = useState<string | null>(null);
  const [mutatingPlatformId, setMutatingPlatformId] = useState<string | null>(null);
  const query = useApiQuery((signal) => tenantId
    ? apiRequest(`/tenants/${encodeURIComponent(tenantId)}/memberships`, responseSchema, { signal })
    : Promise.resolve([]), [tenantId]);
  const platformQuery = useApiQuery((signal) => isSuperAdmin && view === 'PLATFORM'
    ? apiRequest('/user-access', platformResponseSchema, { signal })
    : Promise.resolve([]), [isSuperAdmin, view]);
  const projectsQuery = useApiQuery((signal) => tenantId && view === 'CLIENT'
    ? apiRequest(`/projects?tenantId=${encodeURIComponent(tenantId)}`, projectsResponseSchema, { signal })
    : Promise.resolve([]), [tenantId, view]);
  const tenantsQuery = useApiQuery((signal) => isSuperAdmin && view === 'PLATFORM'
    ? apiRequest('/tenants', tenantsResponseSchema, { signal })
    : Promise.resolve([]), [isSuperAdmin, view]);
  const allItems = useMemo(() => query.status === 'success' ? query.data : [], [query]);
  const counts = useMemo(() => Object.fromEntries(filters.map((item) => [item, allItems.filter((membership) => matchesFilter(membership.status, item)).length])) as Record<Filter, number>, [allItems]);
  const items = useMemo(() => allItems.filter((membership) => {
    const text = `${membership.user.name} ${membership.user.email}`.toLocaleLowerCase(i18n.language);
    return matchesFilter(membership.status, filter) && text.includes(search.trim().toLocaleLowerCase(i18n.language));
  }), [allItems, filter, i18n.language, search]);
  const editingMembership = allItems.find((membership) => membership.userId === editingId);
  const approvalMembership = allItems.find((membership) => membership.userId === approvalId);
  const allPlatformItems = useMemo(() => platformQuery.status === 'success' ? platformQuery.data : [], [platformQuery]);
  const platformCounts = useMemo(() => Object.fromEntries(filters.map((item) => [item, allPlatformItems.filter((identity) => matchesFilter(identity.status, item)).length])) as Record<Filter, number>, [allPlatformItems]);
  const platformItems = useMemo(() => allPlatformItems.filter((identity) => {
    const text = `${identity.name} ${identity.email}`.toLocaleLowerCase(i18n.language);
    return matchesFilter(identity.status, filter) && text.includes(search.trim().toLocaleLowerCase(i18n.language));
  }), [allPlatformItems, filter, i18n.language, search]);
  const editingPlatformIdentity = allPlatformItems.find((identity) => identity.id === editingPlatformId);
  const activeCounts = view === 'PLATFORM' ? platformCounts : counts;

  useEffect(() => { document.title = `${t('accessControl.title')} · ${t('common.appName')}`; }, [t]);
  useEffect(() => { setView(routeView); }, [routeView]);
  useEffect(() => {
    if (filters.includes(requestedFilter as Filter)) setFilter(requestedFilter as Filter);
  }, [requestedFilter]);

  const selectView = (nextView: AccessView) => {
    setView(nextView);
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('view', nextView);
    setSearchParams(nextParams, { replace: true });
  };

  const selectFilter = (nextFilter: Filter) => {
    setFilter(nextFilter);
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('status', nextFilter);
    setSearchParams(nextParams, { replace: true });
  };

  const updateMembership = async (membership: ClientMembership, input: { status?: EditableStatus; role?: ClientRole; projectId?: string | null }) => {
    if (!tenantId) return;
    setMutatingId(membership.userId);
    try {
      await apiRequest(`/tenants/${encodeURIComponent(tenantId)}/memberships/${encodeURIComponent(membership.userId)}`, z.unknown(), {
        method: 'PATCH', headers: csrfHeaders(), body: input,
      });
      toast.success(input.status === 'ACTIVE' && isPendingAccess(membership.status)
        ? t('accessControl.approved')
        : input.status === 'REMOVED' && isPendingAccess(membership.status)
          ? t('accessControl.rejected')
          : t('accessControl.updated'));
      setEditingId(null);
      setApprovalId(null);
      query.retry();
    } catch (cause) {
      toast.error(cause instanceof ApiError ? cause.message : t('forms.error'));
    } finally {
      setMutatingId(null);
    }
  };

  const updatePlatformIdentity = async (identity: PlatformIdentity, input: { status: 'ACTIVE' | 'SUSPENDED' | 'ARCHIVED'; role: 'SUPER_ADMIN' | 'PROJECT_USER'; tenantId?: string | null }) => {
    setMutatingPlatformId(identity.id);
    try {
      await apiRequest(`/user-access/${encodeURIComponent(identity.id)}`, z.unknown(), { method: 'PATCH', headers: csrfHeaders(), body: input });
      toast.success(t('accessControl.updated'));
      setEditingPlatformId(null);
      platformQuery.retry();
    } catch (cause) {
      toast.error(cause instanceof ApiError ? cause.message : t('forms.error'));
    } finally {
      setMutatingPlatformId(null);
    }
  };

  const toolbar = (
    <div className="w-full space-y-3">
      <SearchField value={search} onChange={setSearch} placeholder={t('accessControl.search')} />
      <div className="flex gap-1 overflow-x-auto pb-0.5" role="group" aria-label={t('accessControl.filterLabel')}>
        {filters.map((item) => (
          <Button key={item} size="sm" variant={filter === item ? 'secondary' : 'ghost'} onClick={() => selectFilter(item)} aria-pressed={filter === item} className="shrink-0">
            {t(`accessControl.filters.${item === 'REMOVED' ? 'ARCHIVED' : item}`)}
            <span className="tabular-nums text-muted-foreground">{activeCounts[item]}</span>
          </Button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <PageHeader title={t('accessControl.title')} description={t(isSuperAdmin ? 'accessControl.superDescription' : 'accessControl.clientDescription')} />
      {isSuperAdmin ? (
        <div className="inline-flex max-w-full gap-1 overflow-x-auto rounded-lg border bg-card p-1" role="group" aria-label={t('accessControl.viewLabel')}>
          <Button size="sm" variant={view === 'CLIENT' ? 'secondary' : 'ghost'} aria-pressed={view === 'CLIENT'} onClick={() => selectView('CLIENT')}>{t('accessControl.clientAccess')}</Button>
          <Button size="sm" variant={view === 'PLATFORM' ? 'secondary' : 'ghost'} aria-pressed={view === 'PLATFORM'} onClick={() => selectView('PLATFORM')}>{t('accessControl.platformIdentities')}</Button>
        </div>
      ) : null}
      {view === 'CLIENT' ? <ScopeSelector includeWorkspace={false} /> : null}
      {view === 'CLIENT' && editingMembership ? (
        <FormDialog
          open
          onOpenChange={(open) => { if (!open) setEditingId(null); }}
          title={t('accessControl.editTitle', { name: editingMembership.user.name })}
          description={t('accessControl.editDescription')}
        >
          <AccessEditor
            membership={editingMembership}
            loading={mutatingId === editingMembership.userId}
            onCancel={() => setEditingId(null)}
            onSave={(input) => void updateMembership(editingMembership, input)}
          />
        </FormDialog>
      ) : null}
      {view === 'CLIENT' && approvalMembership ? (
        <FormDialog
          open
          onOpenChange={(open) => { if (!open) setApprovalId(null); }}
          title={t('accessControl.approveTitle', { name: approvalMembership.user.name })}
          description={t('accessControl.approveDescription')}
        >
          <AccessApprovalForm
            membership={approvalMembership}
            projects={projectsQuery.status === 'success' ? projectsQuery.data : []}
            projectsStatus={projectsQuery.status}
            onRetryProjects={projectsQuery.retry}
            loading={mutatingId === approvalMembership.userId}
            onCancel={() => setApprovalId(null)}
            onApprove={(projectId) => void updateMembership(approvalMembership, { status: 'ACTIVE', projectId })}
          />
        </FormDialog>
      ) : null}
      {view === 'PLATFORM' && editingPlatformIdentity ? (
        <FormDialog
          open
          onOpenChange={(open) => { if (!open) setEditingPlatformId(null); }}
          title={t('accessControl.editPlatformTitle', { name: editingPlatformIdentity.name })}
          description={t('accessControl.editPlatformDescription')}
        >
          <PlatformAccessEditor
            identity={editingPlatformIdentity}
            tenants={tenantsQuery.status === 'success' ? tenantsQuery.data : []}
            tenantsStatus={tenantsQuery.status}
            onRetryTenants={tenantsQuery.retry}
            loading={mutatingPlatformId === editingPlatformIdentity.id}
            onCancel={() => setEditingPlatformId(null)}
            onSave={(input) => void updatePlatformIdentity(editingPlatformIdentity, input)}
          />
        </FormDialog>
      ) : null}
      {view === 'PLATFORM' ? (
        <PlatformAccessTable
          items={platformItems}
          status={platformQuery.status}
          toolbar={toolbar}
          currentUserId={auth.status === 'authenticated' ? auth.user.id : ''}
          mutatingId={mutatingPlatformId}
          onRetry={platformQuery.retry}
          onEdit={setEditingPlatformId}
        />
      ) : <DataRegion toolbar={toolbar}>
        {!tenantId ? <EmptyState title={t('context.selectClient')} description={t('context.selectClientDescription')} />
          : query.status === 'loading' ? <LoadingRows />
            : query.status === 'error' ? <ErrorState onRetry={query.retry} />
              : items.length === 0 ? <EmptyState title={search ? t('common.noResults') : t('accessControl.empty')} description={t('accessControl.emptyDescription')} />
                : <ClientAccessTable
                  items={items}
                  currentUserId={auth.status === 'authenticated' ? auth.user.id : ''}
                  mutatingId={mutatingId}
                  onEdit={setEditingId}
                  onApprove={setApprovalId}
                  onStatusChange={(membership, status) => void updateMembership(membership, { status })}
                />}
      </DataRegion>}
    </div>
  );
}

function AccessApprovalForm({ membership, projects, projectsStatus, onRetryProjects, loading, onCancel, onApprove }: { membership: ClientMembership; projects: Project[]; projectsStatus: 'loading' | 'success' | 'error'; onRetryProjects: () => void; loading: boolean; onCancel: () => void; onApprove: (projectId: string | null) => void }) {
  const { t } = useTranslation();
  const activeProjects = projects.filter((project) => project.status === 'ACTIVE');
  const [projectId, setProjectId] = useState(membership.requestedProject?.status === 'ACTIVE' ? membership.requestedProject.id : '');
  return (
    <form onSubmit={(event) => { event.preventDefault(); onApprove(projectId || null); }} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="approval-project">{t('accessControl.projectAssignment')}</Label>
        <select id="approval-project" className="h-11 w-full rounded-md border border-input bg-card px-3 text-base disabled:cursor-not-allowed disabled:opacity-60 md:text-sm" value={projectId} onChange={(event) => setProjectId(event.target.value)} disabled={projectsStatus !== 'success'}>
          <option value="">{projectsStatus === 'loading' ? t('common.loading') : t('accessControl.noProjectAssignment')}</option>
          {activeProjects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
        </select>
        {projectsStatus === 'error' ? <Button type="button" variant="outline" size="sm" onClick={onRetryProjects}>{t('common.retry')}</Button> : null}
        <p className="text-xs leading-5 text-muted-foreground">{t('accessControl.projectAssignmentHint')}</p>
      </div>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={onCancel}>{t('common.cancel')}</Button>
        <Button type="submit" loading={loading} disabled={projectsStatus !== 'success'}><CheckCircle2 />{t('accessControl.approveAndContinue')}</Button>
      </div>
    </form>
  );
}

function PlatformAccessEditor({ identity, tenants, tenantsStatus, onRetryTenants, loading, onCancel, onSave }: { identity: PlatformIdentity; tenants: Tenant[]; tenantsStatus: 'loading' | 'success' | 'error'; onRetryTenants: () => void; loading: boolean; onCancel: () => void; onSave: (input: { status: 'ACTIVE' | 'SUSPENDED' | 'ARCHIVED'; role: 'SUPER_ADMIN' | 'PROJECT_USER'; tenantId?: string | null }) => void }) {
  const { t } = useTranslation();
  const [status, setStatus] = useState<'ACTIVE' | 'SUSPENDED' | 'ARCHIVED'>(identity.status === 'SUSPENDED' ? 'SUSPENDED' : identity.status === 'REMOVED' || identity.status === 'ARCHIVED' ? 'ARCHIVED' : 'ACTIVE');
  const [role, setRole] = useState<'SUPER_ADMIN' | 'PROJECT_USER'>(identity.role === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : 'PROJECT_USER');
  const activeMemberships = identity.clientMemberships.filter((membership) => membership.status === 'ACTIVE');
  const pendingMemberships = identity.clientMemberships.filter((membership) => isPendingAccess(membership.status));
  const availableTenants = isPendingAccess(identity.status) && pendingMemberships.length === 0
    ? tenants.filter((tenant) => tenant.status === 'ACTIVE').map((tenant) => ({ id: tenant.id, name: tenant.name, role: null }))
    : [...activeMemberships, ...pendingMemberships].map((membership) => ({ id: membership.tenantId, name: membership.tenant.name, role: membership.role }));
  const [tenantId, setTenantId] = useState(identity.tenantId ?? activeMemberships[0]?.tenantId ?? pendingMemberships[0]?.tenantId ?? '');
  const [error, setError] = useState<string | null>(null);
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (role !== 'SUPER_ADMIN' && !tenantId) { setError(t('forms.validation.tenant')); return; }
    setError(null);
    onSave({ status, role, tenantId: role === 'SUPER_ADMIN' ? null : tenantId });
  };
  return (
    <form onSubmit={submit} className="space-y-5">
      <MutationNotice message={error} type="error" />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2"><Label htmlFor="platform-status">{t('common.status')}</Label><select id="platform-status" className="h-10 w-full rounded-md border border-input bg-card px-3 text-base md:text-sm" value={status} onChange={(event) => setStatus(event.target.value as typeof status)}><option value="ACTIVE">{t('common.active')}</option><option value="SUSPENDED">{t('common.suspended')}</option><option value="ARCHIVED">{t('common.removed')}</option></select></div>
        <div className="space-y-2"><Label htmlFor="platform-role">{t('accessControl.globalRole')}</Label><select id="platform-role" className="h-10 w-full rounded-md border border-input bg-card px-3 text-base md:text-sm" value={role} onChange={(event) => setRole(event.target.value as typeof role)}><option value="PROJECT_USER">{t('accessControl.standardIdentity')}</option><option value="SUPER_ADMIN">{t('roles.SUPER_ADMIN')}</option></select></div>
      </div>
      {role !== 'SUPER_ADMIN' ? <div className="space-y-2"><Label htmlFor="platform-tenant">{t('accessControl.defaultClient')}</Label><select id="platform-tenant" className="h-11 w-full rounded-md border border-input bg-card px-3 text-base disabled:cursor-not-allowed disabled:opacity-60 md:text-sm" value={tenantId} onChange={(event) => setTenantId(event.target.value)} disabled={tenantsStatus !== 'success'}><option value="">{tenantsStatus === 'loading' ? t('common.loading') : t('forms.selectTenant')}</option>{availableTenants.map((tenant) => <option key={tenant.id} value={tenant.id}>{tenant.name}{tenant.role ? ` · ${t(`roles.${tenant.role}`)}` : ''}</option>)}</select>{tenantsStatus === 'error' ? <Button type="button" variant="outline" size="sm" onClick={onRetryTenants}>{t('common.retry')}</Button> : null}</div> : null}
      <div className="flex gap-2 rounded-md border border-secondary/25 bg-muted p-3 text-sm leading-6 text-foreground"><ShieldCheck className="mt-1 size-4 shrink-0" aria-hidden="true" /><p>{t('accessControl.platformSecurityWarning')}</p></div>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button type="button" variant="outline" onClick={onCancel}>{t('common.cancel')}</Button><Button type="submit" loading={loading} disabled={role !== 'SUPER_ADMIN' && tenantsStatus !== 'success'}>{t('common.save')}</Button></div>
    </form>
  );
}

function AccessEditor({ membership, loading, onCancel, onSave }: { membership: ClientMembership; loading: boolean; onCancel: () => void; onSave: (input: { status: EditableStatus; role: ClientRole }) => void }) {
  const { t } = useTranslation();
  const [status, setStatus] = useState<EditableStatus>(membership.status === 'SUSPENDED' || membership.status === 'REMOVED' ? membership.status : 'ACTIVE');
  const [role, setRole] = useState<ClientRole>(membership.role);

  return (
    <form onSubmit={(event) => { event.preventDefault(); onSave({ status, role }); }} className="space-y-5">
      <MutationNotice message={null} type="error" />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="access-status">{t('common.status')}</Label>
          <select id="access-status" className="h-10 w-full rounded-md border border-input bg-card px-3 text-base md:text-sm" value={status} onChange={(event) => setStatus(event.target.value as EditableStatus)}>
            <option value="ACTIVE">{t('common.active')}</option>
            <option value="SUSPENDED">{t('common.suspended')}</option>
            <option value="REMOVED">{t('common.removed')}</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="access-role">{t('accessControl.role')}</Label>
          <select id="access-role" className="h-10 w-full rounded-md border border-input bg-card px-3 text-base md:text-sm" value={role} onChange={(event) => setRole(event.target.value as ClientRole)}>
            <option value="CLIENT_MEMBER">{t('roles.CLIENT_MEMBER')}</option>
            <option value="CLIENT_ADMIN">{t('roles.CLIENT_ADMIN')}</option>
          </select>
        </div>
      </div>
      <div className="flex gap-2 rounded-md border border-secondary/25 bg-muted p-3 text-sm leading-6 text-foreground"><ShieldCheck className="mt-1 size-4 shrink-0" aria-hidden="true" /><p>{t('accessControl.securityWarning')}</p></div>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button type="button" variant="outline" onClick={onCancel}>{t('common.cancel')}</Button><Button type="submit" loading={loading}>{t('common.save')}</Button></div>
    </form>
  );
}
