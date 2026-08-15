import type { InputHTMLAttributes } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function FormField({ label, error, id, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string }) {
  const errorId = `${id}-error`;
  return <div className="space-y-2"><Label htmlFor={id}>{label}</Label><Input id={id} aria-invalid={Boolean(error)} aria-describedby={error ? errorId : undefined} {...props} />{error ? <p id={errorId} className="text-sm text-destructive" role="alert">{error}</p> : null}</div>;
}
