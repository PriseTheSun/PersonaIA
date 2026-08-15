import { ArrowLeft, Ban, SearchX } from 'lucide-react';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

export function ForbiddenPage() {
  const { t } = useTranslation();
  useEffect(() => { document.title = `403 · ${t('common.appName')}`; }, [t]);
  return <ErrorPage code="403" icon={<Ban />} title={t('forbidden.title')} description={t('forbidden.description')} />;
}

export function NotFoundPage() {
  const { t } = useTranslation();
  useEffect(() => { document.title = `404 · ${t('common.appName')}`; }, [t]);
  return <ErrorPage code="404" icon={<SearchX />} title={t('common.notFound')} description={t('common.notFoundDescription')} />;
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
