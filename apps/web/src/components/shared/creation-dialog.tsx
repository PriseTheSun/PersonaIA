import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

type CreationDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  trigger: ReactNode;
  children: ReactNode;
};

export function CreationDialog({ open, onOpenChange, title, description, trigger, children }: CreationDialogProps) {
  const { t } = useTranslation();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent closeLabel={t('common.close')} className="flex max-h-[calc(100dvh-2rem)] flex-col overflow-hidden p-0 sm:max-w-2xl">
        <header className="shrink-0 border-b px-5 py-4 pr-14 sm:px-6 sm:py-5 sm:pr-14">
          <DialogTitle className="text-lg font-semibold tracking-tight">{title}</DialogTitle>
          <DialogDescription className="mt-1.5 max-w-[70ch] text-sm leading-6 text-muted-foreground">
            {description}
          </DialogDescription>
        </header>
        <div className="min-h-0 overflow-y-auto px-5 py-5 sm:px-6 sm:py-6">{children}</div>
      </DialogContent>
    </Dialog>
  );
}
