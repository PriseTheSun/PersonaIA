import { cva, type VariantProps } from 'class-variance-authority';
import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

const badgeVariants = cva('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium', {
  variants: {
    variant: {
      default: 'bg-primary text-primary-foreground',
      secondary: 'bg-secondary text-secondary-foreground',
      outline: 'border bg-card text-foreground',
      success: 'bg-secondary text-secondary-foreground',
      warning: 'border border-secondary/20 bg-muted text-foreground',
      destructive: 'border border-secondary/40 bg-card text-foreground',
    },
  },
  defaultVariants: { variant: 'default' },
});

export function Badge({ className, variant, ...props }: HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />;
}
