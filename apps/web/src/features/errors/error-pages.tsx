import { ArrowLeft, Ban, Home, LogIn, SearchX } from 'lucide-react';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AppLogo } from '@/components/shared/app-logo';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/features/auth/auth-store';

export function ForbiddenPage() {
  const { t } = useTranslation();
  useEffect(() => { document.title = `403 · ${t('common.appName')}`; }, [t]);
  return <ErrorPage code="403" icon={<Ban />} title={t('forbidden.title')} description={t('forbidden.description')} />;
}

export function NotFoundPage() {
  const { t } = useTranslation();
  const auth = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const isAuthenticated = auth.status === 'authenticated';
  const safeReturnPath = isAuthenticated ? '/' : '/login';
  const goBack = () => location.key === 'default' ? navigate(safeReturnPath) : navigate(-1);
  useEffect(() => { document.title = `404 · ${t('common.appName')}`; }, [t]);
  return (
    <section
      className="relative isolate flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 py-24 sm:px-6"
      aria-labelledby="not-found-title"
    >
      <div className="absolute left-4 top-4 sm:left-8 sm:top-6"><AppLogo className="origin-left scale-90 sm:scale-100" /></div>
      <div className="relative w-full max-w-2xl text-center">
        <div className="flex items-center justify-center gap-4" aria-label={t('notFoundPage.codeLabel')}>
          <span className="grid size-12 shrink-0 place-items-center rounded-lg bg-secondary text-secondary-foreground"><SearchX className="size-5" aria-hidden="true" /></span>
          <span className="text-6xl font-semibold tracking-[-0.04em] text-foreground sm:text-7xl" aria-hidden="true">404</span>
        </div>
        <h1 id="not-found-title" className="mt-7 text-2xl font-semibold tracking-[-0.025em] sm:text-3xl">{t('common.notFound')}</h1>
        <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-muted-foreground sm:text-base">{t('common.notFoundDescription')}</p>

        <div className="mt-7 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Button asChild className="w-full sm:w-auto">
            <Link to={safeReturnPath}>
              {isAuthenticated ? <Home aria-hidden="true" /> : <LogIn aria-hidden="true" />}
              {isAuthenticated ? t('common.backHome') : t('registration.backToLogin')}
            </Link>
          </Button>
          <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={goBack}><ArrowLeft aria-hidden="true" />{t('notFoundPage.backPrevious')}</Button>
        </div>

        <div className="mx-auto mt-9 max-w-xl border-t pt-5 text-left">
          <p className="text-xs font-medium text-muted-foreground">{t('notFoundPage.pathLabel')}</p>
          <code className="mt-1.5 block break-all font-mono text-xs text-foreground" dir="ltr">{location.pathname}</code>
        </div>
      </div>
    </section>
  );
}

function ErrorPage({ code, icon, title, description }: { code: string; icon: React.ReactNode; title: string; description: string }) {
  const { t } = useTranslation();
  return (
    <section className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center text-center">
      <span className="grid size-12 place-items-center rounded-full bg-muted text-muted-foreground [&>svg]:size-5" aria-hidden="true">{icon}</span>
      <p className="mt-4 text-sm font-medium text-[oklch(var(--link))]">{code}</p><h1 className="mt-2 text-2xl font-semibold tracking-[-0.025em]">{title}</h1><p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
      <Button asChild className="mt-6"><Link to="/"><ArrowLeft />{t('common.backHome')}</Link></Button>
    </section>
  );
}
