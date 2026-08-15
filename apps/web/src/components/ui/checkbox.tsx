import { Check } from 'lucide-react';
import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export const Checkbox = forwardRef<HTMLInputElement, Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>>(({ className, ...props }, ref) => (
  <span className="relative inline-flex size-4 shrink-0 align-middle">
    <input
      ref={ref}
      type="checkbox"
      className={cn('peer size-4 appearance-none rounded-[0.2rem] border border-foreground/60 bg-transparent transition-colors duration-150 hover:border-foreground checked:border-foreground checked:bg-transparent disabled:cursor-not-allowed disabled:opacity-50', className)}
      {...props}
    />
    <Check className="pointer-events-none absolute inset-0 m-auto size-3 text-foreground opacity-0 transition-opacity duration-150 peer-checked:opacity-100 peer-disabled:opacity-50" strokeWidth={3} aria-hidden="true" />
  </span>
));
Checkbox.displayName = 'Checkbox';
