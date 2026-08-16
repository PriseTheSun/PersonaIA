import { Plus } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { z } from 'zod';
import { Avatar } from '@/components/shared/avatar';
import { CreationDialog } from '@/components/shared/creation-dialog';
import { DataRegion } from '@/components/shared/data-region';
import { EmptyState, ErrorState, LoadingRows } from '@/components/shared/states';
import { PageHeader } from '@/components/shared/page-header';
import { SearchField } from '@/components/shared/search-field';
import { StatusBadge } from '@/components/shared/status-badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CreateAdminForm } from '@/features/forms/create-admin-form';
import { useApiQuery } from '@/hooks/use-api-query';
import { apiRequest } from '@/lib/api';
import { paginatedSchema, tenantSchema, userSchema } from '@/lib/schemas';
import { formatDate } from '@/lib/utils';

const adminSchema = userSchema.extend({ tenant: z.object({ id: z.string(), name: z.string() }).optional() });
const responseSchema = z.union([z.array(adminSchema), paginatedSchema(adminSchema)]).transform((value) => Array.isArray(value) ? value : value.items);
const tenantResponseSchema = z.union([z.array(tenantSchema), paginatedSchema(tenantSchema)]).transform((value) => Array.isArray(value) ? value : value.items);

export function AdminsPage() {
  const { t, i18n } = useTranslation();
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const query = useApiQuery((signal) => apiRequest('/client-admins', responseSchema, { signal }));
  const tenantsQuery = useApiQuery((signal) => apiRequest('/tenants', tenantResponseSchema, { signal }));
  const items = useMemo(() => query.status === 'success' ? query.data.filter((admin) => `${admin.name} ${admin.email}`.toLowerCase().includes(search.toLowerCase())) : [], [query, search]);
  useEffect(() => { document.title = `${t('admins.title')} · ${t('common.appName')}`; }, [t]);
  return (
    <div className="space-y-6">
      <PageHeader title={t('admins.title')} description={t('admins.description')} action={<CreationDialog open={creating} onOpenChange={setCreating} title={t('forms.createAdminTitle')} description={t('forms.createAdminDescription')} trigger={<Button disabled={tenantsQuery.status !== 'success' || tenantsQuery.data.length === 0}><Plus />{t('admins.create')}</Button>}>{tenantsQuery.status === 'success' ? <CreateAdminForm tenants={tenantsQuery.data} onCancel={() => setCreating(false)} onCreated={() => { setCreating(false); toast.success(t('forms.created')); query.retry(); }} /> : null}</CreationDialog>} />
      <DataRegion toolbar={<SearchField value={search} onChange={setSearch} placeholder={t('admins.search')} />}>
        {query.status === 'loading' ? <LoadingRows /> : query.status === 'error' ? <ErrorState onRetry={query.retry} /> : items.length === 0 ? <EmptyState title={search ? t('common.noResults') : t('admins.empty')} description={t('admins.emptyDescription')} /> : (
          <Table><TableHeader><TableRow><TableHead>{t('admins.columns.admin')}</TableHead><TableHead>{t('admins.columns.tenant')}</TableHead><TableHead>{t('admins.columns.status')}</TableHead><TableHead className="hidden md:table-cell">{t('admins.columns.created')}</TableHead></TableRow></TableHeader>
            <TableBody>{items.map((admin) => <TableRow key={admin.id}><TableCell className="min-w-56"><div className="flex items-center gap-3"><Avatar name={admin.name} /><div className="min-w-0"><div className="truncate font-medium">{admin.name}</div><div className="truncate text-xs text-muted-foreground">{admin.email}</div></div></div></TableCell><TableCell className="min-w-36">{admin.tenant?.name ?? admin.tenantId ?? t('common.unknown')}</TableCell><TableCell><StatusBadge status={admin.status} /></TableCell><TableCell className="hidden text-muted-foreground md:table-cell">{admin.createdAt ? formatDate(admin.createdAt, i18n.language) : t('common.unknown')}</TableCell></TableRow>)}</TableBody>
          </Table>
        )}
      </DataRegion>
    </div>
  );
}
