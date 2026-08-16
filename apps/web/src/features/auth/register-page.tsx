import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, ArrowRight, Clock3, KeyRound, LockKeyhole } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Link, Navigate } from 'react-router-dom';
import { toast } from 'sonner';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { ApiError, apiRequest } from '@/lib/api';
import { registerSchema, type RegisterInput } from '@/lib/schemas';
import { AuthLayout, PublicisEdgeSignature } from './auth-layout';
import { useAuth } from './auth-store';
import { PasswordInput } from './password-input';

const responseSchema = z.object({ status: z.literal('PENDING') });

export function RegisterPage() {
  const { t } = useTranslation();
  const auth = useAuth();
  const [complete, setComplete] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: '', email: '', projectCode: '', password: '', confirmPassword: '' },
  });

  useEffect(() => { document.title = `${t('registration.title')} · ${t('common.appName')}`; }, [t]);
  if (auth.status === 'loading') return <main className="grid min-h-screen place-items-center"><Skeleton className="h-3 w-56" /></main>;
  if (auth.status === 'authenticated') return <Navigate to="/" replace />;

  const onSubmit = handleSubmit(async ({ confirmPassword: _confirmPassword, projectCode, ...input }) => {
    setServerError(null);
    try {
      await apiRequest('/auth/register', responseSchema, {
        method: 'POST',
        body: { ...input, ...(projectCode ? { projectCode } : {}) },
      });
      setComplete(true);
      toast.success(t('registration.requestSent'));
    } catch (error) {
      if (error instanceof ApiError && error.code === 'INVALID_PROJECT_CODE') setServerError(t('registration.invalidProjectCode'));
      else setServerError(error instanceof ApiError ? error.message : t('auth.genericError'));
    }
  });

  return (
    <AuthLayout labelledBy="register-title" contentClassName="max-w-[400px]">
      {complete ? (
        <div className="py-8 text-center">
          <span className="mx-auto grid size-12 place-items-center rounded-full border bg-accent text-accent-foreground"><Clock3 aria-hidden="true" /></span>
          <h1 id="register-title" className="mt-5 text-2xl font-semibold tracking-[-0.03em] sm:text-3xl">{t('registration.successTitle')}</h1>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted-foreground">{t('registration.successDescription')}</p>
          <Button asChild variant="outline" className="mt-6"><Link to="/login"><ArrowLeft />{t('registration.backToLogin')}</Link></Button>
        </div>
      ) : (
        <>
          <div>
            <h1 id="register-title" className="text-2xl font-semibold tracking-[-0.03em] sm:text-3xl">{t('registration.title')}</h1>
            <p className="mt-2 max-w-[48ch] text-sm leading-6 text-muted-foreground">{t('registration.subtitle')}</p>
          </div>
          <form onSubmit={onSubmit} className="mt-7 space-y-5" noValidate>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="register-name" label={t('common.name')} error={errors.name && t(errors.name.message!)}>
                <Input id="register-name" autoComplete="name" placeholder={t('registration.namePlaceholder')} className="h-11" aria-invalid={Boolean(errors.name)} {...register('name')} />
              </Field>
              <Field id="register-email" label={t('common.email')} error={errors.email && t(errors.email.message!)}>
                <Input id="register-email" type="email" inputMode="email" autoComplete="username" placeholder={t('registration.emailPlaceholder')} className="h-11" aria-invalid={Boolean(errors.email)} {...register('email')} />
              </Field>
            </div>
            <Field id="register-project-code" label={t('registration.projectCode')} error={errors.projectCode && t(errors.projectCode.message!)} hint={t('registration.projectCodeHint')}>
              <div className="relative">
                <KeyRound className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                <Input id="register-project-code" autoCapitalize="characters" autoCorrect="off" maxLength={12} placeholder={t('registration.projectCodePlaceholder')} className="h-11 pl-10 font-mono uppercase tracking-[0.12em]" aria-invalid={Boolean(errors.projectCode)} {...register('projectCode')} />
              </div>
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="register-password" label={t('common.password')} error={errors.password && t(errors.password.message!)}>
                <PasswordInput id="register-password" autoComplete="new-password" placeholder={t('auth.passwordPlaceholder')} className="h-11" aria-invalid={Boolean(errors.password)} {...register('password')} />
              </Field>
              <Field id="register-confirm-password" label={t('registration.confirmPassword')} error={errors.confirmPassword && t(errors.confirmPassword.message!)}>
                <PasswordInput id="register-confirm-password" autoComplete="new-password" placeholder={t('registration.confirmPasswordPlaceholder')} className="h-11" aria-invalid={Boolean(errors.confirmPassword)} {...register('confirmPassword')} />
              </Field>
            </div>
            <p className="flex gap-2 text-xs leading-5 text-muted-foreground"><LockKeyhole className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />{t('forms.passwordHint')}</p>
            {serverError ? <div className="rounded-md border border-secondary/40 bg-card px-3 py-2.5 text-sm text-foreground" role="alert">{serverError}</div> : null}
            <Button type="submit" size="lg" className="w-full" loading={isSubmitting}>{isSubmitting ? t('registration.submitting') : t('registration.submit')} {!isSubmitting ? <ArrowRight aria-hidden="true" /> : null}</Button>
          </form>
          <p className="mt-5 border-t pt-5 text-center text-sm text-muted-foreground">{t('registration.alreadyHaveAccount')} <Link to="/login" className="font-medium text-[oklch(var(--link))] hover:underline">{t('auth.submit')}</Link></p>
        </>
      )}
      <PublicisEdgeSignature className="mt-7" />
    </AuthLayout>
  );
}

function Field({ id, label, error, hint, children }: { id: string; label: string; error?: string; hint?: string; children: React.ReactNode }) {
  return <div className="space-y-2"><Label htmlFor={id}>{label}</Label>{children}{hint && !error ? <p className="text-xs leading-5 text-muted-foreground">{hint}</p> : null}{error ? <p className="text-sm text-destructive" role="alert">{error}</p> : null}</div>;
}
