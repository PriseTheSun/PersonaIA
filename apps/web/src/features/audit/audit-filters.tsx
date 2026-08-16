import { ListFilter, RotateCcw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { AuditResponse } from '@/lib/schemas';
import type { AuditFilterState } from './audit-filter-state';

const selectClassName = 'h-10 w-full rounded-md border border-input bg-card px-3 text-base text-foreground transition-colors hover:border-primary/50 md:text-sm';

export function AuditFilters({
  value,
  facets,
  onChange,
  onApply,
  onClear,
}: {
  value: AuditFilterState;
  facets?: AuditResponse['filters'];
  onChange: (value: AuditFilterState) => void;
  onApply: () => void;
  onClear: () => void;
}) {
  const { t } = useTranslation();
  const update = (key: keyof AuditFilterState, next: string) => onChange({ ...value, [key]: next });

  return (
    <form className="grid w-full gap-3 sm:grid-cols-2 xl:grid-cols-6" onSubmit={(event) => { event.preventDefault(); onApply(); }}>
      <div className="space-y-1.5 sm:col-span-2 xl:col-span-2">
        <Label htmlFor="audit-search">{t('audit.searchLabel')}</Label>
        <Input id="audit-search" type="search" maxLength={100} value={value.search} onChange={(event) => update('search', event.target.value)} placeholder={t('audit.searchPlaceholder')} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="audit-tenant">{t('audit.organization')}</Label>
        <select id="audit-tenant" className={selectClassName} value={value.tenantId} onChange={(event) => update('tenantId', event.target.value)}>
          <option value="">{t('audit.allOrganizations')}</option>
          {facets?.tenants.map((tenant) => <option key={tenant.id} value={tenant.id}>{tenant.name}</option>)}
        </select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="audit-action">{t('audit.event')}</Label>
        <select id="audit-action" className={selectClassName} value={value.action} onChange={(event) => update('action', event.target.value)}>
          <option value="">{t('audit.allEvents')}</option>
          {facets?.actions.map((action) => <option key={action} value={action}>{action}</option>)}
        </select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="audit-target-type">{t('audit.resource')}</Label>
        <select id="audit-target-type" className={selectClassName} value={value.targetType} onChange={(event) => update('targetType', event.target.value)}>
          <option value="">{t('audit.allResources')}</option>
          {facets?.targetTypes.map((targetType) => <option key={targetType} value={targetType}>{targetType}</option>)}
        </select>
      </div>
      <div className="grid gap-3 sm:col-span-2 sm:grid-cols-2 xl:col-span-2">
        <div className="space-y-1.5"><Label htmlFor="audit-from">{t('audit.from')}</Label><Input id="audit-from" type="date" value={value.from} onChange={(event) => update('from', event.target.value)} /></div>
        <div className="space-y-1.5"><Label htmlFor="audit-to">{t('audit.to')}</Label><Input id="audit-to" type="date" min={value.from || undefined} value={value.to} onChange={(event) => update('to', event.target.value)} /></div>
      </div>
      <div className="flex flex-col-reverse gap-2 sm:col-span-2 sm:flex-row sm:justify-end xl:col-span-4 xl:self-end">
        <Button type="button" variant="outline" onClick={onClear}><RotateCcw aria-hidden="true" />{t('audit.clearFilters')}</Button>
        <Button type="submit"><ListFilter aria-hidden="true" />{t('audit.applyFilters')}</Button>
      </div>
    </form>
  );
}
