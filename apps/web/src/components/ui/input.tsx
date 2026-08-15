import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(({ className, type, ...props }, ref) => (
  <input
    type={type}
    className={cn('flex h-10 w-full rounded-md border border-input bg-card px-3 py-2 text-base text-foreground transition-colors placeholder:text-muted-foreground hover:border-primary/50 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm', className)}
    ref={ref}
    {...props}
  />
));
Input.displayName = 'Input';
