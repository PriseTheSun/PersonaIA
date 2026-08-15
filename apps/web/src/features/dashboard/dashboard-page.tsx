import { ArrowRight, Clock3, FolderKanban, UserRoundCog, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { EmptyState, ErrorState, LoadingRows } from '@/components/shared/states';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/features/auth/auth-store';
import { useApiQuery } from '@/hooks/use-api-query';
import { apiRequest } from '@/lib/api';
import { dashboardSummarySchema, type DashboardRange } from '@/lib/schemas';
import { formatDate } from '@/lib/utils';
import { DashboardMetrics, type DashboardMetric } from './dashboard-metrics';
import { DashboardRangeSelector } from './dashboard-range-selector';
import { DashboardTrendChart, DashboardTrendChartSkeleton } from './dashboard-trend-chart';

export function DashboardPage() {
  const { t, i18n } = useTranslation();
  const auth = useAuth();
  const [range, setRange] = useState<DashboardRange>('30d');
  const query = useApiQuery(
    (signal) => apiRequest(`/dashboard/summary?range=${range}`, dashboardSummarySchema, { signal }),
    [range],
  );
  const isSuperAdmin = auth.status === 'authenticated' && auth.user.role === 'SUPER_ADMIN';
  const isProjectUser = auth.status === 'authenticated' && ['PROJECT_USER', 'WORKSPACE_MEMBER'].includes(auth.effectiveRole ?? auth.user.role);
  const rangeLabel = t(`dashboard.ranges.${range}`);
  const summary = query.status === 'success' ? query.data : null;

  useEffect(() => { document.title = `${t('dashboard.title')} · ${t('common.appName')}`; }, [t]);

  const metrics: DashboardMetric[] = isProjectUser ? [{
    key: 'accessibleProjects',
    icon: FolderKanban,
    label: t('dashboard.accessibleProjects'),
    description: t('dashboard.accessibleProjectsDescription'),
    value: summary?.metrics.accessibleProjects,
  }] : [
    {
      key: 'projectsCreated',
      icon: FolderKanban,
      label: t('dashboard.projectsCreated'),
      description: t('dashboard.createdInPeriod', { period: rangeLabel }),
      value: summary?.metrics.projectsCreated,
    },
    {
      key: 'personasCreated',
      icon: UserRoundCog,
      label: t('dashboard.personasCreated'),
      description: t('dashboard.createdInPeriod', { period: rangeLabel }),
      value: summary?.metrics.personasCreated,
    },
    {
      key: 'activeUsers',
      icon: Users,
      label: t('dashboard.activeUsers'),
      description: t('dashboard.activeUsersDescription'),
      value: summary?.metrics.activeUsers,
    },
    {
      key: 'pendingAccessRequests',
      icon: Clock3,
      label: t('dashboard.pendingAccessRequests'),
      description: t('dashboard.pendingAccessRequestsDescription'),
      value: summary?.metrics.pendingAccessRequests,
      href: '/access-control',
      attention: (summary?.metrics.pendingAccessRequests ?? 0) > 0,
    },
  ];

  const actions = isSuperAdmin
    ? [{ label: 'dashboard.reviewAccess', to: '/access-control', icon: Clock3 }]
    : isProjectUser ? [] : [
      { label: 'dashboard.createProject', to: '/projects', icon: FolderKanban },
      { label: 'dashboard.manageUsers', to: '/users', icon: Users },
    ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('dashboard.title')}
        description={t(isSuperAdmin ? 'dashboard.superDescription' : isProjectUser ? 'dashboard.userDescription' : 'dashboard.clientDescription')}
        action={!isProjectUser ? <div className="max-w-full overflow-x-auto pb-0.5"><DashboardRangeSelector value={range} onChange={setRange} /></div> : undefined}
      />

      {query.status === 'error' ? <div className="rounded-lg border bg-card"><ErrorState onRetry={query.retry} /></div> : (
        <>
          <DashboardMetrics items={metrics} label={t('dashboard.keyIndicators')} />

          {!isProjectUser ? (
            query.status === 'loading' ? (
              <DashboardTrendChartSkeleton title={t('dashboard.creationTrend')} description={t('dashboard.creationTrendDescription', { period: rangeLabel })} />
            ) : (
              <DashboardTrendChart
                points={query.data.series}
                bucket={query.data.bucket}
                locale={i18n.language}
                title={t('dashboard.creationTrend')}
                description={t('dashboard.creationTrendDescription', { period: rangeLabel })}
                projectsLabel={t('dashboard.projectsCreated')}
                personasLabel={t('dashboard.personasCreated')}
                emptyLabel={t('dashboard.noCreationData')}
                tableCaption={t('dashboard.creationTrendTable')}
              />
            )
          ) : null}

          <div className={actions.length ? 'grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]' : 'grid gap-6'}>
            <section className="overflow-hidden rounded-lg border bg-card">
              <div className="border-b px-4 py-4 sm:px-5"><h2 className="font-semibold">{t('dashboard.activity')}</h2></div>
              {query.status === 'loading' ? <LoadingRows rows={4} /> : query.data.recentActivity.length === 0 ? <EmptyState title={t('dashboard.noActivity')} description={t('dashboard.noActivityDescription')} /> : (
                <ul className="divide-y">{query.data.recentActivity.map((item) => (
                  <li key={item.id} className="flex items-start justify-between gap-4 px-4 py-4 sm:px-5">
                    <span className="text-sm">{item.label}</span>
                    <time className="shrink-0 text-xs text-muted-foreground" dateTime={item.createdAt}>{formatDate(item.createdAt, i18n.language)}</time>
                  </li>
                ))}</ul>
              )}
            </section>
            {actions.length ? (
              <section aria-labelledby="quick-actions-title">
                <h2 id="quick-actions-title" className="mb-3 text-sm font-semibold">{t('dashboard.quickActions')}</h2>
                <div className="divide-y rounded-lg border bg-card">{actions.map(({ label, to, icon: Icon }) => (
                  <Button asChild variant="ghost" className="h-auto min-h-14 w-full justify-start rounded-none px-4 first:rounded-t-lg last:rounded-b-lg" key={label}>
                    <Link to={to}><Icon aria-hidden="true" />{t(label)}<ArrowRight className="ml-auto" aria-hidden="true" /></Link>
                  </Button>
                ))}</div>
              </section>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}
