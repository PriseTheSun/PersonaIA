import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowRight, Eye, EyeOff, LockKeyhole } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { AppLogo } from '@/components/shared/app-logo';
import { LanguageSelector } from '@/components/shared/language-selector';
import { ThemeSelector } from '@/components/shared/theme-selector';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { ApiError } from '@/lib/api';
import { loginSchema, type LoginInput } from '@/lib/schemas';
import { useAuth } from './auth-store';

export function LoginPage() {
  const { t } = useTranslation();
  const auth = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [serverError, setServerError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '', rememberMe: false },
  });

  useEffect(() => { document.title = `${t('auth.title')} · ${t('common.appName')}`; }, [t]);
  if (auth.status === 'loading') return <main className="grid min-h-screen place-items-center"><div className="flex flex-col items-center gap-5" role="status"><AppLogo /><Skeleton className="h-3 w-56" /><span className="sr-only">{t('common.loading')}</span></div></main>;
  if (auth.status === 'authenticated') return <Navigate to="/" replace />;

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    try {
      await auth.login(values);
      const destination = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname ?? '/';
      navigate(destination, { replace: true });
    } catch (error) {
      if (error instanceof ApiError && error.code === 'ACCOUNT_PENDING') setServerError(t('auth.pendingApproval'));
      else if (error instanceof ApiError && error.code === 'ACCOUNT_INACTIVE') setServerError(t('auth.inactiveAccount'));
      else setServerError(error instanceof ApiError && error.status === 401 ? t('auth.invalidCredentials') : t('auth.genericError'));
    }
  });

  return (
    <main className="relative grid min-h-screen place-items-center bg-muted/50 px-4 py-8 sm:px-6">
      <div className="absolute right-3 top-3 flex items-center sm:right-6 sm:top-6"><LanguageSelector /><ThemeSelector /></div>
      <section className="w-full max-w-[420px] rounded-lg border bg-background p-5 sm:p-8" aria-labelledby="login-title">
        <AppLogo />
        <div className="mt-8">
          <h1 id="login-title" className="text-2xl font-semibold tracking-[-0.025em]">{t('auth.title')}</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{t('auth.subtitle')}</p>
        </div>
        <form onSubmit={onSubmit} className="mt-7 space-y-5" noValidate>
          <div className="space-y-2">
            <Label htmlFor="email">{t('common.email')}</Label>
            <Input id="email" type="email" inputMode="email" autoComplete="username" placeholder={t('auth.emailPlaceholder')} aria-invalid={Boolean(errors.email)} aria-describedby={errors.email ? 'email-error' : undefined} {...register('email')} />
            {errors.email ? <p id="email-error" className="text-sm text-destructive" role="alert">{t(errors.email.message ?? 'validation.email')}</p> : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">{t('common.password')}</Label>
            <div className="relative">
              <Input id="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" placeholder={t('auth.passwordPlaceholder')} className="pr-11" aria-invalid={Boolean(errors.password)} aria-describedby={errors.password ? 'password-error' : undefined} {...register('password')} />
              <Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0 text-muted-foreground hover:bg-transparent hover:text-foreground" aria-label={t(showPassword ? 'auth.hidePassword' : 'auth.showPassword')} aria-pressed={showPassword} onClick={() => setShowPassword((visible) => !visible)}>
                {showPassword ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
              </Button>
            </div>
            {errors.password ? <p id="password-error" className="text-sm text-destructive" role="alert">{t(errors.password.message ?? 'validation.passwordLength')}</p> : null}
          </div>
          <div className="flex items-center gap-2.5">
            <Checkbox id="rememberMe" {...register('rememberMe')} />
            <Label htmlFor="rememberMe" className="cursor-pointer font-normal">{t('auth.rememberMe')}</Label>
          </div>
          {serverError ? <div className="rounded-md bg-red-100 px-3 py-2.5 text-sm text-red-950 dark:bg-red-950 dark:text-red-100" role="alert">{serverError}</div> : null}
          <Button type="submit" size="lg" className="w-full" loading={isSubmitting}>{isSubmitting ? t('auth.submitting') : t('auth.submit')} {!isSubmitting ? <ArrowRight aria-hidden="true" /> : null}</Button>
        </form>
        <p className="mt-6 flex gap-2 text-xs leading-5 text-muted-foreground"><LockKeyhole className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />{t('auth.secureSession')}</p>
        <p className="mt-5 border-t pt-5 text-center text-sm text-muted-foreground">{t('registration.noAccount')} <Link to="/register" className="font-medium text-primary hover:underline">{t('registration.createAccount')}</Link></p>
        <div className="mt-7 flex items-center justify-center py-1" aria-label="Publicis Edge">
          <div className="flex flex-col items-center text-muted-foreground" aria-hidden="true">
            <span className="text-[0.625rem] font-semibold leading-none tracking-[0.28em]">PUBLICIS</span>
            <span className="mt-1 text-[2rem] font-black leading-[0.8] tracking-[-0.04em]">EDGE</span>
          </div>
        </div>
      </section>
    </main>
  );
}
