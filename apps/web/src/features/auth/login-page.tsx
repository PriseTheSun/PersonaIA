import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowRight, Eye, EyeOff } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
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
import { LoginBrandPanel } from './login-brand-panel';

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
  if (auth.status === 'loading') return <main className="grid min-h-screen place-items-center"><div role="status"><Skeleton className="h-3 w-56" /><span className="sr-only">{t('common.loading')}</span></div></main>;
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
    <main className="grid min-h-screen place-items-center bg-muted/50 p-4 sm:p-6 lg:p-8">
      <section className="relative grid w-full max-w-[1000px] overflow-hidden rounded-xl border bg-background shadow-sm lg:grid-cols-[0.96fr_1.04fr]" aria-labelledby="login-title">
        <LoginBrandPanel />
        <div className="relative flex min-h-[calc(100svh-2rem)] items-center px-5 py-16 sm:min-h-[640px] sm:px-10 lg:min-h-[650px] lg:px-14 lg:py-8 xl:px-20">
          <div className="absolute right-3 top-3 flex items-center sm:right-5 sm:top-5"><LanguageSelector /><ThemeSelector /></div>
          <div className="mx-auto w-full max-w-[330px]">
            <div className="lg:translate-y-4">
              <h1 id="login-title" className="text-2xl font-semibold tracking-[-0.03em] sm:text-3xl">{t('auth.title')}</h1>
              <p className="mt-2 max-w-[42ch] text-sm leading-6 text-muted-foreground">{t('auth.subtitle')}</p>
            </div>
            <form onSubmit={onSubmit} className="mt-8 space-y-5" noValidate>
              <div className="space-y-2">
                <Label htmlFor="email">{t('common.email')}</Label>
                <Input id="email" type="email" inputMode="email" autoComplete="username" placeholder={t('auth.emailPlaceholder')} className="h-11" aria-invalid={Boolean(errors.email)} aria-describedby={errors.email ? 'email-error' : undefined} {...register('email')} />
                {errors.email ? <p id="email-error" className="text-sm text-destructive" role="alert">{t(errors.email.message ?? 'validation.email')}</p> : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">{t('common.password')}</Label>
                <div className="relative">
                  <Input id="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" placeholder={t('auth.passwordPlaceholder')} className="h-11 pr-11" aria-invalid={Boolean(errors.password)} aria-describedby={errors.password ? 'password-error' : undefined} {...register('password')} />
                  <Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0 h-11 text-muted-foreground hover:bg-transparent hover:text-foreground" aria-label={t(showPassword ? 'auth.hidePassword' : 'auth.showPassword')} aria-pressed={showPassword} onClick={() => setShowPassword((visible) => !visible)}>
                    {showPassword ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
                  </Button>
                </div>
                {errors.password ? <p id="password-error" className="text-sm text-destructive" role="alert">{t(errors.password.message ?? 'validation.passwordLength')}</p> : null}
              </div>
              <div className="flex items-center gap-2.5">
                <Checkbox id="rememberMe" {...register('rememberMe')} />
                <Label htmlFor="rememberMe" className="cursor-pointer font-normal">{t('auth.rememberMe')}</Label>
              </div>
              {serverError ? <div className="rounded-md border border-foreground/40 bg-background px-3 py-2.5 text-sm text-foreground" role="alert">{serverError}</div> : null}
              <Button type="submit" size="lg" className="w-full" loading={isSubmitting}>{isSubmitting ? t('auth.submitting') : t('auth.submit')} {!isSubmitting ? <ArrowRight aria-hidden="true" /> : null}</Button>
            </form>
            <p className="mt-5 border-t pt-5 text-center text-sm text-muted-foreground">{t('registration.noAccount')} <Link to="/register" className="font-medium text-primary hover:underline">{t('registration.createAccount')}</Link></p>
            <div className="mt-7 flex items-center justify-center py-1 lg:absolute lg:bottom-7 lg:left-1/2 lg:mt-0 lg:-translate-x-1/2" aria-label="Publicis Edge">
              <div className="flex flex-col items-center text-muted-foreground" aria-hidden="true">
                <span className="text-[0.625rem] font-semibold leading-none tracking-[0.28em]">PUBLICIS</span>
                <span className="mt-1 text-[2rem] font-black leading-[0.8] tracking-[-0.04em]">EDGE</span>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
