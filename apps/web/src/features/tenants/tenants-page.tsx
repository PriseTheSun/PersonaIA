import { FolderKanban, MoreHorizontal, Plus } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import { z } from 'zod';
import { CreationDialog } from '@/components/shared/creation-dialog';
import { DataRegion } from '@/components/shared/data-region';
import { EmptyState, ErrorState, LoadingRows } from '@/components/shared/states';
import { PageHeader } from '@/components/shared/page-header';
import { SearchField } from '@/components/shared/search-field';
import { StatusBadge } from '@/components/shared/status-badge';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
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
      <PageHeader title={t('tenants.title')} description={t('tenants.description')} action={<CreationDialog open={creating} onOpenChange={setCreating} title={t('forms.createTenantTitle')} description={t('forms.createTenantDescription')} trigger={<Button><Plus />{t('tenants.create')}</Button>}><CreateTenantForm onCancel={() => setCreating(false)} onCreated={() => { setCreating(false); toast.success(t('forms.created')); query.retry(); }} /></CreationDialog>} />
      <DataRegion toolbar={<SearchField value={search} onChange={setSearch} placeholder={t('tenants.search')} />}>
        {query.status === 'loading' ? <LoadingRows /> : query.status === 'error' ? <ErrorState onRetry={query.retry} /> : items.length === 0 ? <EmptyState title={search ? t('common.noResults') : t('tenants.empty')} description={t('tenants.emptyDescription')} /> : (
          <Table className="min-w-[800px]"><TableHeader><TableRow><TableHead className="min-w-56">{t('tenants.columns.tenant')}</TableHead><TableHead className="text-center">{t('tenants.columns.workspaces')}</TableHead><TableHead className="text-center">{t('tenants.columns.admins')}</TableHead><TableHead className="text-center">{t('tenants.columns.projects')}</TableHead><TableHead>{t('common.status')}</TableHead><TableHead>{t('tenants.columns.created')}</TableHead><TableHead className="w-20 text-right">{t('common.actions')}</TableHead></TableRow></TableHeader>
            <TableBody>{items.map((tenant) => <TableRow key={tenant.id}><TableCell><div className="font-medium">{tenant.name}</div><div className="mt-0.5 text-xs text-muted-foreground">{tenant.segment ? `${tenant.segment} · ` : ''}{tenant.slug}</div></TableCell><TableCell className="text-center tabular-nums">{tenant.workspaceCount}</TableCell><TableCell className="text-center tabular-nums">{tenant.adminCount}</TableCell><TableCell className="text-center tabular-nums">{tenant.projectCount}</TableCell><TableCell><StatusBadge status={tenant.status} /></TableCell><TableCell className="whitespace-nowrap text-muted-foreground">{formatDate(tenant.createdAt, i18n.language)}</TableCell><TableCell className="text-right"><DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" aria-label={`${t('common.actions')}: ${tenant.name}`}><MoreHorizontal /></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem asChild><Link to={`/workspaces?tenant=${encodeURIComponent(tenant.id)}`}><FolderKanban />{t('tenants.manage')}</Link></DropdownMenuItem></DropdownMenuContent></DropdownMenu></TableCell></TableRow>)}</TableBody>
          </Table>
        )}
      </DataRegion>
    </div>
  );
}
