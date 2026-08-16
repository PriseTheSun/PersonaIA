import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import type { AuditLog } from '@/lib/schemas';

function Detail({ label, value, technical = false }: { label: string; value: string; technical?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className={technical ? 'mt-1 break-all font-mono text-xs leading-5 text-foreground' : 'mt-1 break-words text-sm text-foreground'}>{value}</dd>
    </div>
  );
}

export function AuditLogDetailsDialog({ entry, onOpenChange }: { entry: AuditLog | null; onOpenChange: (open: boolean) => void }) {
  const { t, i18n } = useTranslation();
  if (!entry) return null;
  const createdAt = new Intl.DateTimeFormat(i18n.resolvedLanguage ?? 'pt-BR', { dateStyle: 'long', timeStyle: 'medium' }).format(new Date(entry.createdAt));
  const metadata = entry.metadata === null ? null : JSON.stringify(entry.metadata, null, 2);

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent closeLabel={t('common.close')} className="flex max-h-[calc(100dvh-2rem)] max-w-2xl flex-col overflow-hidden p-0">
        <header className="shrink-0 border-b px-5 py-4 pr-14 sm:px-6 sm:py-5">
          <Badge variant="outline" className="mb-2 font-mono">{entry.action}</Badge>
          <DialogTitle className="text-lg font-semibold tracking-tight">{t('audit.detailsTitle')}</DialogTitle>
          <DialogDescription className="mt-1 text-sm text-muted-foreground">{createdAt}</DialogDescription>
        </header>
        <div className="min-h-0 overflow-y-auto px-5 py-5 sm:px-6">
          <dl className="grid gap-5 sm:grid-cols-2">
            <Detail label={t('audit.actor')} value={entry.actor ? `${entry.actor.name} · ${entry.actor.email}` : t('audit.systemActor')} />
            <Detail label={t('audit.organization')} value={entry.tenant?.name ?? t('audit.platformScope')} />
            <Detail label={t('audit.resource')} value={entry.targetType} />
            <Detail label={t('audit.scope')} value={entry.scopeType ?? t('common.unknown')} />
            <Detail label={t('audit.logId')} value={entry.id} technical />
            <Detail label={t('audit.targetId')} value={entry.targetId ?? t('common.unknown')} technical />
            <Detail label={t('audit.scopeId')} value={entry.scopeId ?? t('common.unknown')} technical />
          </dl>
          <section className="mt-6 border-t pt-5" aria-labelledby="audit-metadata-title">
            <h3 id="audit-metadata-title" className="text-sm font-semibold">{t('audit.metadata')}</h3>
            {metadata ? <pre className="mt-3 max-h-72 overflow-auto rounded-md bg-muted p-3 text-xs leading-5 text-foreground">{metadata}</pre> : <p className="mt-2 text-sm text-muted-foreground">{t('audit.noMetadata')}</p>}
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
