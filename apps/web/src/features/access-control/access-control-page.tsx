import { Ban, CheckCircle2, CircleX, MoreHorizontal, RotateCcw, ShieldCheck, UserRoundCog } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { z } from 'zod';
import { Avatar } from '@/components/shared/avatar';
import { DataRegion } from '@/components/shared/data-region';
import { InlineForm, MutationNotice } from '@/components/shared/inline-form';
import { PageHeader } from '@/components/shared/page-header';
import { ScopeSelector } from '@/components/shared/scope-selector';
import { SearchField } from '@/components/shared/search-field';
import { EmptyState, ErrorState, LoadingRows } from '@/components/shared/states';
import { StatusBadge } from '@/components/shared/status-badge';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/features/auth/auth-store';
import { useActiveScope } from '@/hooks/use-active-scope';
import { useApiQuery } from '@/hooks/use-api-query';
import { ApiError, apiRequest, csrfHeaders } from '@/lib/api';
import { clientMembershipSchema, paginatedSchema, platformIdentitySchema, type ClientMembership, type ClientRole, type MembershipStatus, type PlatformIdentity } from '@/lib/schemas';
import { formatDate } from '@/lib/utils';

const responseSchema = z.union([z.array(clientMembershipSchema), paginatedSchema(clientMembershipSchema)]).transform((value) => Array.isArray(value) ? value : value.items);
const platformResponseSchema = z.union([z.array(platformIdentitySchema), paginatedSchema(platformIdentitySchema)]).transform((value) => Array.isArray(value) ? value : value.items);
const filters = ['ALL', 'PENDING', 'ACTIVE', 'SUSPENDED', 'REMOVED'] as const;
type Filter = typeof filters[number];
type EditableStatus = Extract<MembershipStatus, 'ACTIVE' | 'SUSPENDED' | 'REMOVED'>;
type AccessView = 'CLIENT' | 'PLATFORM';

function isPending(status: MembershipStatus) {
  return status === 'PENDING' || status === 'PENDING_APPROVAL' || status === 'INVITED';
}

function matchesFilter(status: MembershipStatus, filter: Filter) {
  if (filter === 'ALL') return true;
  if (filter === 'PENDING') return isPending(status);
  return status === filter;
}

export function AccessControlPage() {
  const { t, i18n } = useTranslation();
  const auth = useAuth();
  const { tenantId } = useActiveScope();
  const isSuperAdmin = auth.status === 'authenticated' && auth.user.role === 'SUPER_ADMIN';
  const [view, setView] = useState<AccessView>('CLIENT');
  const [search, setSearch] = useState('');
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedFilter = searchParams.get('status');
  const initialFilter = filters.includes(requestedFilter as Filter) ? requestedFilter as Filter : 'PENDING';
  const [filter, setFilter] = useState<Filter>(initialFilter);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [mutatingId, setMutatingId] = useState<string | null>(null);
  const [editingPlatformId, setEditingPlatformId] = useState<string | null>(null);
  const [mutatingPlatformId, setMutatingPlatformId] = useState<string | null>(null);
  const query = useApiQuery((signal) => tenantId
    ? apiRequest(`/tenants/${encodeURIComponent(tenantId)}/memberships`, responseSchema, { signal })
    : Promise.resolve([]), [tenantId]);
  const platformQuery = useApiQuery((signal) => isSuperAdmin && view === 'PLATFORM'
    ? apiRequest('/user-access', platformResponseSchema, { signal })
    : Promise.resolve([]), [isSuperAdmin, view]);
  const allItems = useMemo(() => query.status === 'success' ? query.data : [], [query]);
  const counts = useMemo(() => Object.fromEntries(filters.map((item) => [item, allItems.filter((membership) => matchesFilter(membership.status, item)).length])) as Record<Filter, number>, [allItems]);
  const items = useMemo(() => allItems.filter((membership) => {
    const text = `${membership.user.name} ${membership.user.email}`.toLocaleLowerCase(i18n.language);
    return matchesFilter(membership.status, filter) && text.includes(search.trim().toLocaleLowerCase(i18n.language));
  }), [allItems, filter, i18n.language, search]);
  const editingMembership = allItems.find((membership) => membership.userId === editingId);
  const platformItems = platformQuery.status === 'success' ? platformQuery.data : [];
  const editingPlatformIdentity = platformItems.find((identity) => identity.id === editingPlatformId);

  useEffect(() => { document.title = `${t('accessControl.title')} · ${t('common.appName')}`; }, [t]);
  useEffect(() => {
    if (filters.includes(requestedFilter as Filter)) setFilter(requestedFilter as Filter);
  }, [requestedFilter]);

  const selectFilter = (nextFilter: Filter) => {
    setFilter(nextFilter);
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('status', nextFilter);
    setSearchParams(nextParams, { replace: true });
  };

  const updateMembership = async (membership: ClientMembership, input: { status?: EditableStatus; role?: ClientRole }) => {
    if (!tenantId) return;
    setMutatingId(membership.userId);
    try {
      await apiRequest(`/tenants/${encodeURIComponent(tenantId)}/memberships/${encodeURIComponent(membership.userId)}`, z.unknown(), {
        method: 'PATCH', headers: csrfHeaders(), body: input,
      });
      toast.success(input.status === 'ACTIVE' && isPending(membership.status)
        ? t('accessControl.approved')
        : input.status === 'REMOVED' && isPending(membership.status)
          ? t('accessControl.rejected')
          : t('accessControl.updated'));
      setEditingId(null);
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

  return (
    <div className="space-y-6">
      <PageHeader title={t('accessControl.title')} description={t(isSuperAdmin ? 'accessControl.superDescription' : 'accessControl.clientDescription')} />
      {isSuperAdmin ? (
        <div className="inline-flex max-w-full gap-1 overflow-x-auto rounded-lg border bg-card p-1" role="group" aria-label={t('accessControl.viewLabel')}>
          <Button size="sm" variant={view === 'CLIENT' ? 'secondary' : 'ghost'} aria-pressed={view === 'CLIENT'} onClick={() => setView('CLIENT')}>{t('accessControl.clientAccess')}</Button>
          <Button size="sm" variant={view === 'PLATFORM' ? 'secondary' : 'ghost'} aria-pressed={view === 'PLATFORM'} onClick={() => setView('PLATFORM')}>{t('accessControl.platformIdentities')}</Button>
        </div>
      ) : null}
      {view === 'CLIENT' ? <ScopeSelector includeWorkspace={false} /> : null}
      {view === 'CLIENT' && editingMembership ? (
        <InlineForm title={t('accessControl.editTitle', { name: editingMembership.user.name })} description={t('accessControl.editDescription')} onClose={() => setEditingId(null)}>
          <AccessEditor
            membership={editingMembership}
            loading={mutatingId === editingMembership.userId}
            onCancel={() => setEditingId(null)}
            onSave={(input) => void updateMembership(editingMembership, input)}
          />
        </InlineForm>
      ) : null}
      {view === 'PLATFORM' && editingPlatformIdentity ? (
        <InlineForm title={t('accessControl.editPlatformTitle', { name: editingPlatformIdentity.name })} description={t('accessControl.editPlatformDescription')} onClose={() => setEditingPlatformId(null)}>
          <PlatformAccessEditor identity={editingPlatformIdentity} loading={mutatingPlatformId === editingPlatformIdentity.id} onCancel={() => setEditingPlatformId(null)} onSave={(input) => void updatePlatformIdentity(editingPlatformIdentity, input)} />
        </InlineForm>
      ) : null}
      {view === 'PLATFORM' ? (
        <PlatformIdentityList
          items={platformItems}
          status={platformQuery.status}
          currentUserId={auth.status === 'authenticated' ? auth.user.id : ''}
          mutatingId={mutatingPlatformId}
          onRetry={platformQuery.retry}
          onEdit={setEditingPlatformId}
        />
      ) : <DataRegion toolbar={
        <div className="w-full space-y-3">
          <SearchField value={search} onChange={setSearch} placeholder={t('accessControl.search')} />
          <div className="flex gap-1 overflow-x-auto pb-0.5" role="group" aria-label={t('accessControl.filterLabel')}>
            {filters.map((item) => (
              <Button key={item} size="sm" variant={filter === item ? 'secondary' : 'ghost'} onClick={() => selectFilter(item)} aria-pressed={filter === item} className="shrink-0">
                {t(`accessControl.filters.${item === 'REMOVED' ? 'ARCHIVED' : item}`)}
                <span className="tabular-nums text-muted-foreground">{counts[item]}</span>
              </Button>
            ))}
          </div>
        </div>
      }>
        {!tenantId ? <EmptyState title={t('context.selectClient')} description={t('context.selectClientDescription')} />
          : query.status === 'loading' ? <LoadingRows />
            : query.status === 'error' ? <ErrorState onRetry={query.retry} />
              : items.length === 0 ? <EmptyState title={search ? t('common.noResults') : t('accessControl.empty')} description={t('accessControl.emptyDescription')} />
                : (
                  <ul className="divide-y">
                    {items.map((membership) => {
                      const isSelf = auth.status === 'authenticated' && auth.user.id === membership.userId;
                      const canManage = !isSelf;
                      return (
                        <li key={membership.userId} className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:px-5">
                          <div className="flex min-w-0 flex-1 items-center gap-3">
                            <Avatar name={membership.user.name} />
                            <div className="min-w-0">
                              <h2 className="truncate text-sm font-semibold">{membership.user.name}{isSelf ? <span className="ml-2 text-xs font-normal text-muted-foreground">{t('accessControl.you')}</span> : null}</h2>
                              <p className="truncate text-xs text-muted-foreground">{membership.user.email}</p>
                              {membership.createdAt ? <time className="mt-1 block text-xs text-muted-foreground" dateTime={membership.createdAt}>{formatDate(membership.createdAt, i18n.language)}</time> : null}
                            </div>
                          </div>
                          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                            <span className="text-xs font-medium">{t(`roles.${membership.role}`)}</span>
                            <StatusBadge status={membership.status} />
                          </div>
                          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                            {isPending(membership.status) && canManage ? (
                              <>
                                <Button size="sm" onClick={() => void updateMembership(membership, { status: 'ACTIVE' })} loading={mutatingId === membership.userId}><CheckCircle2 />{t('accessControl.approve')}</Button>
                                <Button size="sm" variant="outline" onClick={() => void updateMembership(membership, { status: 'REMOVED' })} disabled={mutatingId === membership.userId}><CircleX />{t('accessControl.reject')}</Button>
                              </>
                            ) : null}
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" disabled={!canManage || mutatingId === membership.userId} aria-label={`${t('common.actions')}: ${membership.user.name}`}><MoreHorizontal /></Button></DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onSelect={() => setEditingId(membership.userId)}><UserRoundCog />{t('accessControl.editAccess')}</DropdownMenuItem>
                                <DropdownMenuSeparator />
                                {membership.status !== 'ACTIVE'
                                  ? <DropdownMenuItem onSelect={() => void updateMembership(membership, { status: 'ACTIVE' })}><RotateCcw />{isPending(membership.status) ? t('accessControl.approve') : t('accessControl.activate')}</DropdownMenuItem>
                                  : <DropdownMenuItem className="text-destructive" onSelect={() => void updateMembership(membership, { status: 'SUSPENDED' })}><Ban />{t('accessControl.deactivate')}</DropdownMenuItem>}
                                {isPending(membership.status) ? <DropdownMenuItem className="text-destructive" onSelect={() => void updateMembership(membership, { status: 'REMOVED' })}><CircleX />{t('accessControl.reject')}</DropdownMenuItem> : null}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
      </DataRegion>}
    </div>
  );
}

function PlatformIdentityList({ items, status, currentUserId, mutatingId, onRetry, onEdit }: { items: PlatformIdentity[]; status: 'loading' | 'success' | 'error'; currentUserId: string; mutatingId: string | null; onRetry: () => void; onEdit: (id: string) => void }) {
  const { t, i18n } = useTranslation();
  return (
    <DataRegion>
      {status === 'loading' ? <LoadingRows /> : status === 'error' ? <ErrorState onRetry={onRetry} /> : items.length === 0 ? <EmptyState title={t('accessControl.empty')} description={t('accessControl.platformEmptyDescription')} /> : (
        <ul className="divide-y">
          {items.map((identity) => {
            const isSelf = identity.id === currentUserId;
            return (
              <li key={identity.id} className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:px-5">
                <div className="flex min-w-0 flex-1 items-center gap-3"><Avatar name={identity.name} /><div className="min-w-0"><h2 className="truncate text-sm font-semibold">{identity.name}{isSelf ? <span className="ml-2 text-xs font-normal text-muted-foreground">{t('accessControl.you')}</span> : null}</h2><p className="truncate text-xs text-muted-foreground">{identity.email}</p>{identity.createdAt ? <time className="mt-1 block text-xs text-muted-foreground" dateTime={identity.createdAt}>{formatDate(identity.createdAt, i18n.language)}</time> : null}</div></div>
                <div className="flex flex-wrap items-center gap-2"><span className="text-xs font-medium">{t(`roles.${identity.role}`)}</span><StatusBadge status={identity.status} /><span className="text-xs text-muted-foreground">{t('accessControl.membershipCount', { count: identity.membershipCount })}</span></div>
                <Button variant="ghost" size="icon" disabled={isSelf || mutatingId === identity.id} onClick={() => onEdit(identity.id)} aria-label={`${t('accessControl.editAccess')}: ${identity.name}`}><UserRoundCog /></Button>
              </li>
            );
          })}
        </ul>
      )}
    </DataRegion>
  );
}

function PlatformAccessEditor({ identity, loading, onCancel, onSave }: { identity: PlatformIdentity; loading: boolean; onCancel: () => void; onSave: (input: { status: 'ACTIVE' | 'SUSPENDED' | 'ARCHIVED'; role: 'SUPER_ADMIN' | 'PROJECT_USER'; tenantId?: string | null }) => void }) {
  const { t } = useTranslation();
  const [status, setStatus] = useState<'ACTIVE' | 'SUSPENDED' | 'ARCHIVED'>(identity.status === 'SUSPENDED' ? 'SUSPENDED' : identity.status === 'REMOVED' || identity.status === 'ARCHIVED' ? 'ARCHIVED' : 'ACTIVE');
  const [role, setRole] = useState<'SUPER_ADMIN' | 'PROJECT_USER'>(identity.role === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : 'PROJECT_USER');
  const activeMemberships = identity.clientMemberships.filter((membership) => membership.status === 'ACTIVE');
  const [tenantId, setTenantId] = useState(identity.tenantId ?? activeMemberships[0]?.tenantId ?? '');
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
      {role !== 'SUPER_ADMIN' ? <div className="space-y-2"><Label htmlFor="platform-tenant">{t('accessControl.defaultClient')}</Label><select id="platform-tenant" className="h-10 w-full rounded-md border border-input bg-card px-3 text-base md:text-sm" value={tenantId} onChange={(event) => setTenantId(event.target.value)}><option value="">{t('forms.selectTenant')}</option>{activeMemberships.map((membership) => <option key={membership.tenantId} value={membership.tenantId}>{membership.tenant.name} · {t(`roles.${membership.role}`)}</option>)}</select></div> : null}
      <div className="flex gap-2 rounded-md border border-secondary/25 bg-muted p-3 text-sm leading-6 text-foreground"><ShieldCheck className="mt-1 size-4 shrink-0" aria-hidden="true" /><p>{t('accessControl.platformSecurityWarning')}</p></div>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button type="button" variant="outline" onClick={onCancel}>{t('common.cancel')}</Button><Button type="submit" loading={loading}>{t('common.save')}</Button></div>
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
