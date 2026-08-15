import { MoreHorizontal, Plus } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { Avatar } from '@/components/shared/avatar';
import { DataRegion } from '@/components/shared/data-region';
import { InlineForm, MutationNotice } from '@/components/shared/inline-form';
import { EmptyState, ErrorState, LoadingRows } from '@/components/shared/states';
import { PageHeader } from '@/components/shared/page-header';
import { SearchField } from '@/components/shared/search-field';
import { StatusBadge } from '@/components/shared/status-badge';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CreateUserForm } from '@/features/forms/create-user-form';
import { MoveUserForm } from '@/features/forms/move-user-form';
import { useApiQuery } from '@/hooks/use-api-query';
import { apiRequest } from '@/lib/api';
import { paginatedSchema, permissionSchema, projectSchema, userSchema } from '@/lib/schemas';
import { formatDate } from '@/lib/utils';

const membershipSchema = z.object({ permission: permissionSchema, project: z.object({ id: z.string(), name: z.string(), slug: z.string().optional(), status: z.string().optional() }) });
const projectUserSchema = userSchema.extend({ projectCount: z.number().int().nonnegative().optional(), memberships: z.array(membershipSchema).default([]) }).transform((user) => ({ ...user, projectCount: user.projectCount ?? user.memberships.length }));
const responseSchema = z.union([z.array(projectUserSchema), paginatedSchema(projectUserSchema)]).transform((value) => Array.isArray(value) ? value : value.items);
const projectResponseSchema = z.union([z.array(projectSchema), paginatedSchema(projectSchema)]).transform((value) => Array.isArray(value) ? value : value.items);

export function UsersPage() {
  const { t, i18n } = useTranslation();
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const [movingUserId, setMovingUserId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const query = useApiQuery((signal) => apiRequest('/users', responseSchema, { signal }));
  const projectsQuery = useApiQuery((signal) => apiRequest('/projects', projectResponseSchema, { signal }));
  const items = useMemo(() => query.status === 'success' ? query.data.filter((user) => `${user.name} ${user.email}`.toLowerCase().includes(search.toLowerCase())) : [], [query, search]);
  const movingUser = items.find((user) => user.id === movingUserId);
  useEffect(() => { document.title = `${t('users.title')} · ${t('common.appName')}`; }, [t]);
  return (
    <div className="space-y-6">
      <PageHeader title={t('users.title')} description={t('users.description')} action={<Button onClick={() => { setCreating(true); setMovingUserId(null); setNotice(null); }}><Plus />{t('users.invite')}</Button>} />
      <MutationNotice message={notice} />
      {creating && projectsQuery.status === 'success' ? <InlineForm title={t('forms.createUserTitle')} description={t('forms.createUserDescription')} onClose={() => setCreating(false)}><CreateUserForm projects={projectsQuery.data} onCancel={() => setCreating(false)} onCreated={() => { setCreating(false); setNotice(t('forms.created')); query.retry(); }} /></InlineForm> : null}
      {movingUser && projectsQuery.status === 'success' ? <InlineForm title={t('forms.moveUserTitle', { name: movingUser.name })} description={t('forms.moveUserDescription')} onClose={() => setMovingUserId(null)}><MoveUserForm userId={movingUser.id} memberships={movingUser.memberships} projects={projectsQuery.data} onCancel={() => setMovingUserId(null)} onMoved={() => { setMovingUserId(null); setNotice(t('forms.moved')); query.retry(); }} /></InlineForm> : null}
      <DataRegion toolbar={<SearchField value={search} onChange={setSearch} placeholder={t('users.search')} />}>
        {query.status === 'loading' ? <LoadingRows /> : query.status === 'error' ? <ErrorState onRetry={query.retry} /> : items.length === 0 ? <EmptyState title={search ? t('common.noResults') : t('users.empty')} description={t('users.emptyDescription')} /> : (
          <Table><TableHeader><TableRow><TableHead>{t('users.columns.user')}</TableHead><TableHead>{t('users.columns.projects')}</TableHead><TableHead>{t('users.columns.status')}</TableHead><TableHead className="hidden md:table-cell">{t('users.columns.created')}</TableHead><TableHead className="w-12"><span className="sr-only">{t('common.actions')}</span></TableHead></TableRow></TableHeader>
            <TableBody>{items.map((user) => <TableRow key={user.id}><TableCell className="min-w-56"><div className="flex items-center gap-3"><Avatar name={user.name} /><div className="min-w-0"><div className="truncate font-medium">{user.name}</div><div className="truncate text-xs text-muted-foreground">{user.email}</div></div></div></TableCell><TableCell>{t('users.projectAccess', { count: user.projectCount })}</TableCell><TableCell><StatusBadge status={user.status} /></TableCell><TableCell className="hidden text-muted-foreground md:table-cell">{user.createdAt ? formatDate(user.createdAt, i18n.language) : t('common.unknown')}</TableCell><TableCell><DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" aria-label={`${t('common.actions')}: ${user.name}`}><MoreHorizontal /></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem disabled={user.memberships.length === 0 || (projectsQuery.status === 'success' && projectsQuery.data.length < 2)} onSelect={() => { setMovingUserId(user.id); setCreating(false); setNotice(null); }}>{t('forms.moveUser')}</DropdownMenuItem></DropdownMenuContent></DropdownMenu></TableCell></TableRow>)}</TableBody>
          </Table>
        )}
      </DataRegion>
    </div>
  );
}
