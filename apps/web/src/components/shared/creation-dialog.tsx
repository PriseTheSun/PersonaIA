import type { ReactNode } from 'react';
import { FormDialog } from '@/components/shared/form-dialog';

type CreationDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  trigger: ReactNode;
  children: ReactNode;
};

export function CreationDialog({ open, onOpenChange, title, description, trigger, children }: CreationDialogProps) {
  return (
    <FormDialog open={open} onOpenChange={onOpenChange} title={title} description={description} trigger={trigger}>
      {children}
    </FormDialog>
  );
}
