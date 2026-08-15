import { ArrowRight, FolderKanban, Plus, Users } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import { z } from 'zod';
import { DataRegion } from '@/components/shared/data-region';
import { InlineForm } from '@/components/shared/inline-form';
import { EmptyState, ErrorState, LoadingRows } from '@/components/shared/states';
import { PageHeader } from '@/components/shared/page-header';
import { SearchField } from '@/components/shared/search-field';
import { StatusBadge } from '@/components/shared/status-badge';
import { Button } from '@/components/ui/button';
import { CreateProjectForm } from '@/features/forms/create-project-form';
import { useApiQuery } from '@/hooks/use-api-query';
import { apiRequest } from '@/lib/api';
import { paginatedSchema, projectSchema } from '@/lib/schemas';
import { formatDate } from '@/lib/utils';

const responseSchema = z.union([z.array(projectSchema), paginatedSchema(projectSchema)]).transform((value) => Array.isArray(value) ? value : value.items);

export function ProjectsPage() {
  const { t, i18n } = useTranslation();
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const query = useApiQuery((signal) => apiRequest('/projects', responseSchema, { signal }));
  const items = useMemo(() => query.status === 'success' ? query.data.filter((project) => project.name.toLowerCase().includes(search.toLowerCase())) : [], [query, search]);
  useEffect(() => { document.title = `${t('projects.title')} · ${t('common.appName')}`; }, [t]);
  return (
    <div className="space-y-6">
      <PageHeader title={t('projects.title')} description={t('projects.description')} action={<Button onClick={() => setCreating(true)}><Plus />{t('projects.create')}</Button>} />
      {creating ? <InlineForm title={t('forms.createProjectTitle')} description={t('forms.createProjectDescription')} onClose={() => setCreating(false)}><CreateProjectForm onCancel={() => setCreating(false)} onCreated={() => { setCreating(false); toast.success(t('forms.created')); query.retry(); }} /></InlineForm> : null}
      <DataRegion toolbar={<SearchField value={search} onChange={setSearch} placeholder={t('projects.search')} />}>
        {query.status === 'loading' ? <LoadingRows /> : query.status === 'error' ? <ErrorState onRetry={query.retry} /> : items.length === 0 ? <EmptyState title={search ? t('common.noResults') : t('projects.empty')} description={t('projects.emptyDescription')} /> : (
          <ul className="divide-y">{items.map((project) => (
            <li key={project.id} className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:px-5">
              <span className="grid size-10 shrink-0 place-items-center rounded-md bg-secondary text-secondary-foreground"><FolderKanban className="size-5" aria-hidden="true" /></span>
              <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h2 className="truncate text-sm font-semibold">{project.name}</h2><StatusBadge status={project.status} /></div><p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{project.description || t('projects.description')}</p></div>
              <div className="flex items-center justify-between gap-2 sm:justify-end"><span className="flex items-center gap-1.5 text-xs text-muted-foreground"><Users className="size-3.5" aria-hidden="true" />{t('projects.memberCount', { count: project.memberCount })} · {formatDate(project.updatedAt, i18n.language)}</span><Button asChild variant="ghost" size="sm"><Link to={`/permissions?project=${encodeURIComponent(project.id)}`}>{t('projects.open')}<ArrowRight /></Link></Button></div>
            </li>
          ))}</ul>
        )}
      </DataRegion>
    </div>
  );
}
