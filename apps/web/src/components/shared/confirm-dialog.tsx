import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

export function ConfirmDialog({ title, description, confirmLabel, trigger, destructive = false, loading = false, onConfirm }: { title: string; description: string; confirmLabel: string; trigger: ReactNode; destructive?: boolean; loading?: boolean; onConfirm: () => void }) {
  const { t } = useTranslation();
  return (
    <Dialog>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent aria-describedby="confirm-dialog-description">
        <DialogTitle className="pr-8 text-lg font-semibold">{title}</DialogTitle>
        <DialogDescription id="confirm-dialog-description" className="mt-2 text-sm leading-6 text-muted-foreground">{description}</DialogDescription>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <DialogClose asChild><Button variant="outline">{t('common.cancel')}</Button></DialogClose>
          <Button variant={destructive ? 'destructive' : 'default'} loading={loading} onClick={onConfirm}>{confirmLabel}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
