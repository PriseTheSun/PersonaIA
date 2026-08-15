import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, ArrowRight, Clock3, LockKeyhole, UserPlus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Link, Navigate } from 'react-router-dom';
import { toast } from 'sonner';
import { z } from 'zod';
import { AppLogo } from '@/components/shared/app-logo';
import { LanguageSelector } from '@/components/shared/language-selector';
import { ThemeSelector } from '@/components/shared/theme-selector';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { ApiError, apiRequest } from '@/lib/api';
import { registerSchema, type RegisterInput } from '@/lib/schemas';
import { useAuth } from './auth-store';

const responseSchema = z.object({ status: z.literal('PENDING') });

export function RegisterPage() {
  const { t } = useTranslation();
  const auth = useAuth();
  const [complete, setComplete] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: '', email: '', tenantSlug: '', password: '', confirmPassword: '' },
  });

  useEffect(() => { document.title = `${t('registration.title')} · ${t('common.appName')}`; }, [t]);
  if (auth.status === 'loading') return <main className="grid min-h-screen place-items-center"><Skeleton className="h-3 w-56" /></main>;
  if (auth.status === 'authenticated') return <Navigate to="/" replace />;

  const onSubmit = handleSubmit(async ({ confirmPassword: _confirmPassword, ...input }) => {
    setServerError(null);
    try {
      await apiRequest('/auth/register', responseSchema, { method: 'POST', body: input });
      setComplete(true);
      toast.success(t('registration.requestSent'));
    } catch (error) {
      if (error instanceof ApiError && error.code === 'INVALID_TENANT') setServerError(t('registration.invalidTenant'));
      else setServerError(error instanceof ApiError ? error.message : t('auth.genericError'));
    }
  });

  return (
    <main className="relative grid min-h-screen place-items-center bg-muted/50 px-4 py-16 sm:px-6">
      <div className="absolute right-3 top-3 flex items-center sm:right-6 sm:top-6"><LanguageSelector /><ThemeSelector /></div>
      <section className="w-full max-w-[500px] rounded-lg border bg-background p-5 sm:p-8" aria-labelledby="register-title">
        <AppLogo />
        {complete ? (
          <div className="py-8 text-center">
            <span className="mx-auto grid size-12 place-items-center rounded-full border bg-muted text-foreground"><Clock3 aria-hidden="true" /></span>
            <h1 id="register-title" className="mt-5 text-2xl font-semibold tracking-[-0.025em]">{t('registration.successTitle')}</h1>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted-foreground">{t('registration.successDescription')}</p>
            <Button asChild variant="outline" className="mt-6"><Link to="/login"><ArrowLeft />{t('registration.backToLogin')}</Link></Button>
          </div>
        ) : (
          <>
            <div className="mt-8">
              <div className="flex items-center gap-2 text-sm font-medium text-primary"><UserPlus className="size-4" aria-hidden="true" />{t('registration.eyebrow')}</div>
              <h1 id="register-title" className="mt-2 text-2xl font-semibold tracking-[-0.025em]">{t('registration.title')}</h1>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{t('registration.subtitle')}</p>
            </div>
            <form onSubmit={onSubmit} className="mt-7 space-y-5" noValidate>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field id="register-name" label={t('common.name')} error={errors.name && t(errors.name.message!)}>
                  <Input id="register-name" autoComplete="name" aria-invalid={Boolean(errors.name)} {...register('name')} />
                </Field>
                <Field id="register-email" label={t('common.email')} error={errors.email && t(errors.email.message!)}>
                  <Input id="register-email" type="email" inputMode="email" autoComplete="username" aria-invalid={Boolean(errors.email)} {...register('email')} />
                </Field>
              </div>
              <Field id="register-tenant" label={t('registration.tenantCode')} error={errors.tenantSlug && t(errors.tenantSlug.message!)} hint={t('registration.tenantHint')}>
                <Input id="register-tenant" autoCapitalize="none" autoCorrect="off" placeholder="empresa-exemplo" aria-invalid={Boolean(errors.tenantSlug)} {...register('tenantSlug')} />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field id="register-password" label={t('common.password')} error={errors.password && t(errors.password.message!)}>
                  <Input id="register-password" type="password" autoComplete="new-password" aria-invalid={Boolean(errors.password)} {...register('password')} />
                </Field>
                <Field id="register-confirm-password" label={t('registration.confirmPassword')} error={errors.confirmPassword && t(errors.confirmPassword.message!)}>
                  <Input id="register-confirm-password" type="password" autoComplete="new-password" aria-invalid={Boolean(errors.confirmPassword)} {...register('confirmPassword')} />
                </Field>
              </div>
              <p className="flex gap-2 text-xs leading-5 text-muted-foreground"><LockKeyhole className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />{t('forms.passwordHint')}</p>
              {serverError ? <div className="rounded-md border border-foreground/40 bg-background px-3 py-2.5 text-sm text-foreground" role="alert">{serverError}</div> : null}
              <Button type="submit" size="lg" className="w-full" loading={isSubmitting}>{isSubmitting ? t('registration.submitting') : t('registration.submit')} {!isSubmitting ? <ArrowRight aria-hidden="true" /> : null}</Button>
            </form>
            <p className="mt-6 text-center text-sm text-muted-foreground">{t('registration.alreadyHaveAccount')} <Link to="/login" className="font-medium text-primary hover:underline">{t('auth.submit')}</Link></p>
          </>
        )}
      </section>
    </main>
  );
}

function Field({ id, label, error, hint, children }: { id: string; label: string; error?: string; hint?: string; children: React.ReactNode }) {
  return <div className="space-y-2"><Label htmlFor={id}>{label}</Label>{children}{hint && !error ? <p className="text-xs leading-5 text-muted-foreground">{hint}</p> : null}{error ? <p className="text-sm text-destructive" role="alert">{error}</p> : null}</div>;
}
