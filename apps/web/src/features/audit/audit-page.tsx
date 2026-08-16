import { Eye, MoreHorizontal } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DataRegion } from '@/components/shared/data-region';
import { PageHeader } from '@/components/shared/page-header';
import { EmptyState, ErrorState, LoadingRows } from '@/components/shared/states';
import { useApiQuery } from '@/hooks/use-api-query';
import { apiRequest } from '@/lib/api';
import { auditResponseSchema, type AuditLog } from '@/lib/schemas';
import { AuditFilters } from './audit-filters';
import { emptyAuditFilters, type AuditFilterState } from './audit-filter-state';
import { AuditLogDetailsDialog } from './audit-log-details-dialog';

function resourceId(entry: AuditLog) {
  return entry.targetId ? `${entry.targetId.slice(0, 8)}…` : '—';
}

export function AuditPage() {
  const { t, i18n } = useTranslation();
  const [draftFilters, setDraftFilters] = useState<AuditFilterState>(emptyAuditFilters);
  const [filters, setFilters] = useState<AuditFilterState>(emptyAuditFilters);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<AuditLog | null>(null);
  const queryString = useMemo(() => {
    const parameters = new URLSearchParams({ page: String(page), pageSize: '25' });
    Object.entries(filters).forEach(([key, value]) => { if (value) parameters.set(key, value); });
    return parameters.toString();
  }, [filters, page]);
  const query = useApiQuery((signal) => apiRequest(`/audit-logs?${queryString}`, auditResponseSchema, { signal }), [queryString]);
  const locale = i18n.resolvedLanguage ?? 'pt-BR';
  const formatDate = (value: string) => new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
  const applyFilters = () => { setPage(1); setFilters(draftFilters); };
  const clearFilters = () => { setPage(1); setDraftFilters(emptyAuditFilters); setFilters(emptyAuditFilters); };
  const hasFilters = Object.values(filters).some(Boolean);
  const data = query.status === 'success' ? query.data : null;

  return (
    <div className="space-y-6">
      <PageHeader title={t('audit.title')} description={t('audit.description')} />
      <DataRegion toolbar={<AuditFilters value={draftFilters} facets={data?.filters} onChange={setDraftFilters} onApply={applyFilters} onClear={clearFilters} />}>
        {query.status === 'loading' ? <LoadingRows rows={8} /> : query.status === 'error' ? <ErrorState onRetry={query.retry} /> : !data ? <LoadingRows rows={8} /> : data.items.length === 0 ? (
          <EmptyState title={hasFilters ? t('audit.noResults') : t('audit.empty')} description={hasFilters ? t('audit.noResultsDescription') : t('audit.emptyDescription')} action={hasFilters ? <Button variant="outline" onClick={clearFilters}>{t('audit.clearFilters')}</Button> : undefined} />
        ) : (
          <>
            <div className="hidden md:block">
              <Table>
                <TableHeader><TableRow><TableHead>{t('audit.event')}</TableHead><TableHead>{t('audit.actor')}</TableHead><TableHead>{t('audit.organization')}</TableHead><TableHead>{t('audit.resource')}</TableHead><TableHead>{t('audit.date')}</TableHead><TableHead className="w-16 text-right"><span className="sr-only">{t('common.actions')}</span></TableHead></TableRow></TableHeader>
                <TableBody>{data.items.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell><Badge variant="outline" className="max-w-64 font-mono"><span className="truncate">{entry.action}</span></Badge></TableCell>
                    <TableCell><p className="max-w-52 truncate font-medium">{entry.actor?.name ?? t('audit.systemActor')}</p><p className="max-w-52 truncate text-xs text-muted-foreground">{entry.actor?.email ?? '—'}</p></TableCell>
                    <TableCell><p className="max-w-48 truncate">{entry.tenant?.name ?? t('audit.platformScope')}</p>{entry.tenant ? <p className="text-xs text-muted-foreground">{entry.tenant.slug}</p> : null}</TableCell>
                    <TableCell><p className="font-medium">{entry.targetType}</p><p className="font-mono text-xs text-muted-foreground">{resourceId(entry)}</p></TableCell>
                    <TableCell className="whitespace-nowrap text-sm">{formatDate(entry.createdAt)}</TableCell>
                    <TableCell className="text-right"><DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" aria-label={`${t('common.actions')}: ${entry.action}`}><MoreHorizontal aria-hidden="true" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onSelect={() => setSelected(entry)}><Eye aria-hidden="true" />{t('audit.viewDetails')}</DropdownMenuItem></DropdownMenuContent></DropdownMenu></TableCell>
                  </TableRow>
                ))}</TableBody>
              </Table>
            </div>
            <ol className="divide-y md:hidden" aria-label={t('audit.records')}>
              {data.items.map((entry) => <li key={entry.id} className="space-y-3 p-4"><div className="flex min-w-0 items-start justify-between gap-3"><Badge variant="outline" className="min-w-0 max-w-full font-mono"><span className="truncate">{entry.action}</span></Badge><span className="shrink-0 text-xs text-muted-foreground">{formatDate(entry.createdAt)}</span></div><dl className="grid gap-3 text-sm"><div><dt className="text-xs text-muted-foreground">{t('audit.actor')}</dt><dd className="mt-0.5 truncate font-medium">{entry.actor?.name ?? t('audit.systemActor')}</dd></div><div><dt className="text-xs text-muted-foreground">{t('audit.organization')}</dt><dd className="mt-0.5 truncate">{entry.tenant?.name ?? t('audit.platformScope')}</dd></div><div><dt className="text-xs text-muted-foreground">{t('audit.resource')}</dt><dd className="mt-0.5 font-mono text-xs">{entry.targetType} · {resourceId(entry)}</dd></div></dl><Button type="button" variant="outline" className="w-full" onClick={() => setSelected(entry)}><Eye aria-hidden="true" />{t('audit.viewDetails')}</Button></li>)}
            </ol>
            <footer className="flex flex-col gap-3 border-t px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground" role="status">{t('audit.results', { count: data.pagination.total })}</p>
              <nav className="flex items-center justify-between gap-2 sm:justify-end" aria-label={t('audit.pagination')}><Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>{t('common.previous')}</Button><span className="px-1 text-sm tabular-nums">{t('common.page', { current: data.pagination.page, total: data.pagination.totalPages })}</span><Button variant="outline" size="sm" disabled={page >= data.pagination.totalPages} onClick={() => setPage((value) => value + 1)}>{t('common.next')}</Button></nav>
            </footer>
          </>
        )}
      </DataRegion>
      <AuditLogDetailsDialog entry={selected} onOpenChange={(open) => { if (!open) setSelected(null); }} />
    </div>
  );
}
