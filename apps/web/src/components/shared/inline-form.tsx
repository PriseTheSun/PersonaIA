import { X } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';

export function InlineForm({ title, description, onClose, children }: { title: string; description: string; onClose: () => void; children: ReactNode }) {
  const { t } = useTranslation();
  return (
    <section className="rounded-lg border bg-muted/30 p-4 sm:p-5" aria-labelledby="inline-form-title">
      <div className="flex items-start justify-between gap-3"><div><h2 id="inline-form-title" className="font-semibold">{title}</h2><p className="mt-1 max-w-[70ch] text-sm leading-6 text-muted-foreground">{description}</p></div><Button variant="ghost" size="icon" onClick={onClose} aria-label={t('common.close')}><X /></Button></div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

export function MutationNotice({ message, type = 'success' }: { message: string | null; type?: 'success' | 'error' }) {
  if (!message) return null;
  return <div className={type === 'success' ? 'rounded-md border bg-muted px-3 py-2.5 text-sm text-foreground' : 'rounded-md border border-secondary/40 bg-card px-3 py-2.5 text-sm text-foreground'} role={type === 'error' ? 'alert' : 'status'}>{message}</div>;
}
