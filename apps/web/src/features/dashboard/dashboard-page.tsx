import { ArrowRight, Building2, FolderKanban, ShieldCheck, Users, UserRoundCog } from 'lucide-react';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { EmptyState, ErrorState, LoadingRows } from '@/components/shared/states';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { apiRequest } from '@/lib/api';
import { dashboardSummarySchema } from '@/lib/schemas';
import { formatDate } from '@/lib/utils';
import { useApiQuery } from '@/hooks/use-api-query';
import { useAuth } from '@/features/auth/auth-store';

export function DashboardPage() {
  const { t, i18n } = useTranslation();
  const auth = useAuth();
  const query = useApiQuery((signal) => apiRequest('/dashboard/summary', dashboardSummarySchema, { signal }));
  const isSuperAdmin = auth.status === 'authenticated' && auth.user.role === 'SUPER_ADMIN';
  const isProjectUser = auth.status === 'authenticated' && auth.user.role === 'PROJECT_USER';
  useEffect(() => { document.title = `${t('dashboard.title')} · ${t('common.appName')}`; }, [t]);
  const metrics = isSuperAdmin
    ? [{ key: 'tenants', icon: Building2 }, { key: 'clientAdmins', icon: ShieldCheck }]
    : isProjectUser ? [{ key: 'projects', icon: FolderKanban }]
      : [{ key: 'projects', icon: FolderKanban }, { key: 'users', icon: Users }, { key: 'activePersonas', icon: UserRoundCog }];
  const labels: Record<string, string> = { tenants: 'dashboard.tenants', clientAdmins: 'dashboard.admins', projects: 'dashboard.projects', users: 'dashboard.users', activePersonas: 'dashboard.personas' };
  const actions = isSuperAdmin
    ? [{ label: 'dashboard.createTenant', to: '/tenants', icon: Building2 }, { label: 'dashboard.createAdmin', to: '/administrators', icon: ShieldCheck }]
    : isProjectUser ? [] : [{ label: 'dashboard.createProject', to: '/projects', icon: FolderKanban }, { label: 'dashboard.manageUsers', to: '/users', icon: Users }];
  return (
    <div className="space-y-7">
      <PageHeader title={t('dashboard.title')} description={t(isSuperAdmin ? 'dashboard.superDescription' : isProjectUser ? 'dashboard.userDescription' : 'dashboard.clientDescription')} />
      {query.status === 'error' ? <div className="rounded-lg border"><ErrorState onRetry={query.retry} /></div> : (
        <>
          <section className="grid overflow-hidden rounded-lg border bg-card sm:grid-cols-2 lg:grid-cols-3" aria-label={t('dashboard.title')}>
            {metrics.map(({ key, icon: Icon }, index) => (
              <div key={key} className={`flex min-h-28 items-center gap-4 p-5 ${index > 0 ? 'border-t sm:border-l sm:border-t-0' : ''} ${index === 2 ? 'sm:border-l-0 sm:border-t lg:border-l lg:border-t-0' : ''}`}>
                <span className="grid size-10 shrink-0 place-items-center rounded-md bg-secondary"><Icon className="size-5 text-secondary-foreground" aria-hidden="true" /></span>
                <div><p className="text-sm text-muted-foreground">{t(labels[key])}</p>{query.status === 'loading' ? <Skeleton className="mt-2 h-7 w-14" /> : <p className="mt-0.5 text-2xl font-semibold tabular-nums">{query.data[key as keyof typeof query.data] as number ?? 0}</p>}</div>
              </div>
            ))}
          </section>
          <div className={actions.length ? 'grid gap-7 lg:grid-cols-[minmax(0,1fr)_320px]' : 'grid gap-7'}>
            <section className="overflow-hidden rounded-lg border bg-card">
              <div className="border-b px-4 py-4 sm:px-5"><h2 className="font-semibold">{t('dashboard.activity')}</h2></div>
              {query.status === 'loading' ? <LoadingRows rows={4} /> : query.data.recentActivity.length === 0 ? <EmptyState title={t('dashboard.noActivity')} description={t('dashboard.noActivityDescription')} /> : (
                <ul className="divide-y">{query.data.recentActivity.map((item) => <li key={item.id} className="flex items-start justify-between gap-4 px-4 py-4 sm:px-5"><span className="text-sm">{item.label}</span><time className="shrink-0 text-xs text-muted-foreground" dateTime={item.createdAt}>{formatDate(item.createdAt, i18n.language)}</time></li>)}</ul>
              )}
            </section>
            {actions.length ? <section aria-labelledby="quick-actions-title">
              <h2 id="quick-actions-title" className="mb-3 text-sm font-semibold">{t('dashboard.quickActions')}</h2>
              <div className="divide-y rounded-lg border bg-card">{actions.map(({ label, to, icon: Icon }) => <Button asChild variant="ghost" className="h-auto min-h-14 w-full justify-start rounded-none px-4 first:rounded-t-lg last:rounded-b-lg" key={label}><Link to={to}><Icon aria-hidden="true" />{t(label)}<ArrowRight className="ml-auto" aria-hidden="true" /></Link></Button>)}</div>
            </section> : null}
          </div>
        </>
      )}
    </div>
  );
}
