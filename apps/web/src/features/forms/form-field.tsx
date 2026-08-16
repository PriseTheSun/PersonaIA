import { forwardRef, type InputHTMLAttributes } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type FormFieldProps = InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string };

export const FormField = forwardRef<HTMLInputElement, FormFieldProps>(({ label, error, id, ...props }, ref) => {
  const errorId = `${id}-error`;
  return <div className="space-y-2"><Label htmlFor={id}>{label}</Label><Input ref={ref} id={id} aria-invalid={Boolean(error)} aria-describedby={error ? errorId : undefined} {...props} />{error ? <p id={errorId} className="text-sm text-destructive" role="alert">{error}</p> : null}</div>;
});

FormField.displayName = 'FormField';
