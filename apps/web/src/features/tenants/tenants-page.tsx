import { Plus } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { z } from 'zod';
import { DataRegion } from '@/components/shared/data-region';
import { InlineForm } from '@/components/shared/inline-form';
import { EmptyState, ErrorState, LoadingRows } from '@/components/shared/states';
import { PageHeader } from '@/components/shared/page-header';
import { SearchField } from '@/components/shared/search-field';
import { StatusBadge } from '@/components/shared/status-badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CreateTenantForm } from '@/features/forms/create-tenant-form';
import { useApiQuery } from '@/hooks/use-api-query';
import { apiRequest } from '@/lib/api';
import { paginatedSchema, tenantSchema } from '@/lib/schemas';
import { formatDate } from '@/lib/utils';

const responseSchema = z.union([z.array(tenantSchema), paginatedSchema(tenantSchema)]).transform((value) => Array.isArray(value) ? value : value.items);

export function TenantsPage() {
  const { t, i18n } = useTranslation();
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const query = useApiQuery((signal) => apiRequest('/tenants', responseSchema, { signal }));
  const items = useMemo(() => query.status === 'success' ? query.data.filter((tenant) => `${tenant.name} ${tenant.slug}`.toLowerCase().includes(search.toLowerCase())) : [], [query, search]);
  useEffect(() => { document.title = `${t('tenants.title')} · ${t('common.appName')}`; }, [t]);
  return (
    <div className="space-y-6">
      <PageHeader title={t('tenants.title')} description={t('tenants.description')} action={<Button onClick={() => setCreating(true)}><Plus />{t('tenants.create')}</Button>} />
      {creating ? <InlineForm title={t('forms.createTenantTitle')} description={t('forms.createTenantDescription')} onClose={() => setCreating(false)}><CreateTenantForm onCancel={() => setCreating(false)} onCreated={() => { setCreating(false); toast.success(t('forms.created')); query.retry(); }} /></InlineForm> : null}
      <DataRegion toolbar={<SearchField value={search} onChange={setSearch} placeholder={t('tenants.search')} />}>
        {query.status === 'loading' ? <LoadingRows /> : query.status === 'error' ? <ErrorState onRetry={query.retry} /> : items.length === 0 ? <EmptyState title={search ? t('common.noResults') : t('tenants.empty')} description={t('tenants.emptyDescription')} /> : (
          <Table><TableHeader><TableRow><TableHead>{t('tenants.columns.tenant')}</TableHead><TableHead>{t('tenants.columns.admins')}</TableHead><TableHead>{t('tenants.columns.projects')}</TableHead><TableHead className="hidden sm:table-cell">{t('tenants.columns.created')}</TableHead></TableRow></TableHeader>
            <TableBody>{items.map((tenant) => <TableRow key={tenant.id}><TableCell className="min-w-48"><div className="font-medium">{tenant.name}</div><div className="mt-0.5 text-xs text-muted-foreground">{tenant.slug}</div></TableCell><TableCell className="tabular-nums">{tenant.adminCount}</TableCell><TableCell className="tabular-nums">{tenant.projectCount}</TableCell><TableCell className="hidden text-muted-foreground sm:table-cell"><span className="mr-2"><StatusBadge status={tenant.status} /></span>{formatDate(tenant.createdAt, i18n.language)}</TableCell></TableRow>)}</TableBody>
          </Table>
        )}
      </DataRegion>
    </div>
  );
}
