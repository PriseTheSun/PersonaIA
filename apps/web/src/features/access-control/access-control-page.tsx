import { Ban, CheckCircle2, MoreHorizontal, RotateCcw, ShieldCheck, UserRoundCog } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { z } from 'zod';
import { Avatar } from '@/components/shared/avatar';
import { DataRegion } from '@/components/shared/data-region';
import { InlineForm, MutationNotice } from '@/components/shared/inline-form';
import { EmptyState, ErrorState, LoadingRows } from '@/components/shared/states';
import { PageHeader } from '@/components/shared/page-header';
import { SearchField } from '@/components/shared/search-field';
import { StatusBadge } from '@/components/shared/status-badge';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAuth } from '@/features/auth/auth-store';
import { useApiQuery } from '@/hooks/use-api-query';
import { ApiError, apiRequest, csrfHeaders } from '@/lib/api';
import { paginatedSchema, roleSchema, tenantSchema, userAccessSchema, type Role, type UserAccess } from '@/lib/schemas';
import { formatDate } from '@/lib/utils';

const responseSchema = z.union([z.array(userAccessSchema), paginatedSchema(userAccessSchema)]).transform((value) => Array.isArray(value) ? value : value.items);
const tenantResponseSchema = z.union([z.array(tenantSchema), paginatedSchema(tenantSchema)]).transform((value) => Array.isArray(value) ? value : value.items);
const filters = ['ALL', 'PENDING', 'ACTIVE', 'SUSPENDED'] as const;
type Filter = typeof filters[number];

export function AccessControlPage() {
  const { t, i18n } = useTranslation();
  const auth = useAuth();
  const isSuperAdmin = auth.status === 'authenticated' && auth.user.role === 'SUPER_ADMIN';
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('PENDING');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [mutatingId, setMutatingId] = useState<string | null>(null);
  const query = useApiQuery((signal) => apiRequest('/user-access', responseSchema, { signal }));
  const tenantsQuery = useApiQuery((signal) => isSuperAdmin ? apiRequest('/tenants', tenantResponseSchema, { signal }) : Promise.resolve([]), [isSuperAdmin]);
  const allItems = useMemo(() => query.status === 'success' ? query.data : [], [query]);
  const counts = useMemo(() => ({
    ALL: allItems.length,
    PENDING: allItems.filter((user) => user.status === 'PENDING').length,
    ACTIVE: allItems.filter((user) => user.status === 'ACTIVE').length,
    SUSPENDED: allItems.filter((user) => user.status === 'SUSPENDED').length,
  }), [allItems]);
  const items = useMemo(() => allItems.filter((user) => {
    const matchesStatus = filter === 'ALL' || user.status === filter;
    const text = `${user.name} ${user.email} ${user.tenant?.name ?? ''}`.toLowerCase();
    return matchesStatus && text.includes(search.toLowerCase());
  }), [allItems, filter, search]);
  const editingUser = allItems.find((user) => user.id === editingId);

  useEffect(() => { document.title = `${t('accessControl.title')} · ${t('common.appName')}`; }, [t]);

  const updateUser = async (user: UserAccess, input: { status?: 'ACTIVE' | 'SUSPENDED'; role?: Role; tenantId?: string | null }) => {
    setMutatingId(user.id);
    try {
      await apiRequest(`/user-access/${encodeURIComponent(user.id)}`, z.unknown(), {
        method: 'PATCH', headers: csrfHeaders(), body: input
      });
      toast.success(input.status === 'ACTIVE' && user.status === 'PENDING' ? t('accessControl.approved') : t('accessControl.updated'));
      setEditingId(null);
      query.retry();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : t('forms.error'));
    } finally {
      setMutatingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title={t('accessControl.title')} description={t(isSuperAdmin ? 'accessControl.superDescription' : 'accessControl.clientDescription')} />
      {editingUser && tenantsQuery.status === 'success' ? (
        <InlineForm title={t('accessControl.editTitle', { name: editingUser.name })} description={t('accessControl.editDescription')} onClose={() => setEditingId(null)}>
          <AccessEditor
            user={editingUser}
            tenants={tenantsQuery.data}
            isSuperAdmin={isSuperAdmin}
            loading={mutatingId === editingUser.id}
            onCancel={() => setEditingId(null)}
            onSave={(input) => updateUser(editingUser, input)}
          />
        </InlineForm>
      ) : null}
      <DataRegion toolbar={
        <div className="w-full space-y-3">
          <SearchField value={search} onChange={setSearch} placeholder={t('accessControl.search')} />
          <div className="flex gap-2 overflow-x-auto pb-0.5" role="group" aria-label={t('accessControl.filterLabel')}>
            {filters.map((item) => <Button key={item} size="sm" variant={filter === item ? 'secondary' : 'ghost'} onClick={() => setFilter(item)} aria-pressed={filter === item}>{t(`accessControl.filters.${item}`)} <span className="tabular-nums text-muted-foreground">{counts[item]}</span></Button>)}
          </div>
        </div>
      }>
        {query.status === 'loading' ? <LoadingRows /> : query.status === 'error' ? <ErrorState onRetry={query.retry} /> : items.length === 0 ? <EmptyState title={search ? t('common.noResults') : t('accessControl.empty')} description={t('accessControl.emptyDescription')} /> : (
          <Table>
            <TableHeader><TableRow><TableHead>{t('users.columns.user')}</TableHead><TableHead className="hidden md:table-cell">{t('accessControl.role')}</TableHead><TableHead className="hidden lg:table-cell">{t('common.tenant')}</TableHead><TableHead>{t('common.status')}</TableHead><TableHead className="hidden xl:table-cell">{t('common.createdAt')}</TableHead><TableHead className="w-12"><span className="sr-only">{t('common.actions')}</span></TableHead></TableRow></TableHeader>
            <TableBody>{items.map((user) => {
              const isSelf = auth.status === 'authenticated' && auth.user.id === user.id;
              const canManage = !isSelf && (isSuperAdmin || user.role === 'PROJECT_USER');
              return (
                <TableRow key={user.id}>
                  <TableCell className="min-w-56"><div className="flex items-center gap-3"><Avatar name={user.name} /><div className="min-w-0"><div className="truncate font-medium">{user.name}{isSelf ? <span className="ml-2 text-xs font-normal text-muted-foreground">{t('accessControl.you')}</span> : null}</div><div className="truncate text-xs text-muted-foreground">{user.email}</div><div className="mt-1 text-xs text-muted-foreground md:hidden">{t(`roles.${user.role}`)}{user.tenant ? ` · ${user.tenant.name}` : ''}</div></div></div></TableCell>
                  <TableCell className="hidden md:table-cell">{t(`roles.${user.role}`)}</TableCell>
                  <TableCell className="hidden text-muted-foreground lg:table-cell">{user.tenant?.name ?? t('accessControl.platform')}</TableCell>
                  <TableCell><div className="flex min-w-max items-center gap-2"><StatusBadge status={user.status} />{user.status === 'PENDING' && canManage ? <Button size="sm" onClick={() => updateUser(user, { status: 'ACTIVE' })} loading={mutatingId === user.id}><CheckCircle2 />{t('accessControl.approve')}</Button> : null}</div></TableCell>
                  <TableCell className="hidden text-muted-foreground xl:table-cell">{user.createdAt ? formatDate(user.createdAt, i18n.language) : t('common.unknown')}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" disabled={!canManage} aria-label={`${t('common.actions')}: ${user.name}`}><MoreHorizontal /></Button></DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onSelect={() => setEditingId(user.id)}><UserRoundCog />{t('accessControl.editAccess')}</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        {user.status !== 'ACTIVE' ? <DropdownMenuItem onSelect={() => updateUser(user, { status: 'ACTIVE' })}><RotateCcw />{user.status === 'PENDING' ? t('accessControl.approve') : t('accessControl.activate')}</DropdownMenuItem> : <DropdownMenuItem className="text-destructive" onSelect={() => updateUser(user, { status: 'SUSPENDED' })}><Ban />{t('accessControl.deactivate')}</DropdownMenuItem>}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })}</TableBody>
          </Table>
        )}
      </DataRegion>
    </div>
  );
}

function AccessEditor({ user, tenants, isSuperAdmin, loading, onCancel, onSave }: { user: UserAccess; tenants: z.infer<typeof tenantSchema>[]; isSuperAdmin: boolean; loading: boolean; onCancel: () => void; onSave: (input: { status: 'ACTIVE' | 'SUSPENDED'; role?: Role; tenantId?: string | null }) => void }) {
  const { t } = useTranslation();
  const [status, setStatus] = useState<'ACTIVE' | 'SUSPENDED'>(user.status === 'SUSPENDED' ? 'SUSPENDED' : 'ACTIVE');
  const [role, setRole] = useState<Role>(user.role);
  const [tenantId, setTenantId] = useState(user.tenantId ?? '');
  const [error, setError] = useState<string | null>(null);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (isSuperAdmin && role !== 'SUPER_ADMIN' && !tenantId) {
      setError(t('forms.validation.tenant'));
      return;
    }
    setError(null);
    onSave(isSuperAdmin ? { status, role, tenantId: role === 'SUPER_ADMIN' ? null : tenantId } : { status });
  };

  return (
    <form onSubmit={submit} className="space-y-5">
      <MutationNotice message={error} type="error" />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2"><Label htmlFor="access-status">{t('common.status')}</Label><select id="access-status" className="h-10 w-full rounded-md border border-input bg-card px-3 text-base md:text-sm" value={status} onChange={(event) => setStatus(event.target.value as 'ACTIVE' | 'SUSPENDED')}><option value="ACTIVE">{t('common.active')}</option><option value="SUSPENDED">{t('common.suspended')}</option></select></div>
        {isSuperAdmin ? <div className="space-y-2"><Label htmlFor="access-role">{t('accessControl.role')}</Label><select id="access-role" className="h-10 w-full rounded-md border border-input bg-card px-3 text-base md:text-sm" value={role} onChange={(event) => setRole(roleSchema.parse(event.target.value))}><option value="PROJECT_USER">{t('roles.PROJECT_USER')}</option><option value="CLIENT_ADMIN">{t('roles.CLIENT_ADMIN')}</option><option value="SUPER_ADMIN">{t('roles.SUPER_ADMIN')}</option></select></div> : null}
      </div>
      {isSuperAdmin && role !== 'SUPER_ADMIN' ? <div className="space-y-2"><Label htmlFor="access-tenant">{t('common.tenant')}</Label><select id="access-tenant" className="h-10 w-full rounded-md border border-input bg-card px-3 text-base md:text-sm" value={tenantId} onChange={(event) => setTenantId(event.target.value)}><option value="">{t('forms.selectTenant')}</option>{tenants.filter((tenant) => tenant.status === 'ACTIVE').map((tenant) => <option value={tenant.id} key={tenant.id}>{tenant.name}</option>)}</select></div> : null}
      {isSuperAdmin ? <div className="flex gap-2 rounded-md border border-secondary/25 bg-muted p-3 text-sm leading-6 text-foreground"><ShieldCheck className="mt-1 size-4 shrink-0" aria-hidden="true" /><p>{t('accessControl.securityWarning')}</p></div> : null}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button type="button" variant="outline" onClick={onCancel}>{t('common.cancel')}</Button><Button type="submit" loading={loading}>{t('common.save')}</Button></div>
    </form>
  );
}
