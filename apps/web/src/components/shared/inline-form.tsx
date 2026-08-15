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
  return <div className={type === 'success' ? 'rounded-md bg-emerald-100 px-3 py-2.5 text-sm text-emerald-950 dark:bg-emerald-950 dark:text-emerald-100' : 'rounded-md bg-red-100 px-3 py-2.5 text-sm text-red-950 dark:bg-red-950 dark:text-red-100'} role={type === 'error' ? 'alert' : 'status'}>{message}</div>;
}
