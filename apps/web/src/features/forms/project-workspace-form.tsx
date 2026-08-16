import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { MutationNotice } from '@/components/shared/inline-form';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { apiRequest, csrfHeaders } from '@/lib/api';
import type { Project, Workspace } from '@/lib/schemas';

export function ProjectWorkspaceForm({ project, workspaces, onSaved, onCancel }: {
  project: Project;
  workspaces: Workspace[];
  onSaved: () => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [workspaceId, setWorkspaceId] = useState(project.workspaceId ?? '');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await apiRequest(`/projects/${encodeURIComponent(project.id)}`, z.unknown(), {
        method: 'PATCH',
        headers: csrfHeaders(),
        body: { workspaceId: workspaceId || null },
      });
      onSaved();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('forms.error'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={(event) => void submit(event)} className="space-y-5">
      <MutationNotice message={error} type="error" />
      <div className="space-y-2">
        <Label htmlFor="organize-project-workspace">{t('forms.projectWorkspace')}</Label>
        <select
          id="organize-project-workspace"
          value={workspaceId}
          onChange={(event) => setWorkspaceId(event.target.value)}
          className="h-10 w-full rounded-md border border-input bg-card px-3 text-base md:text-sm"
        >
          <option value="">{t('forms.noWorkspace')}</option>
          {workspaces.map((workspace) => <option key={workspace.id} value={workspace.id}>{workspace.name}</option>)}
        </select>
        <p className="text-xs leading-5 text-muted-foreground">{t('forms.projectWorkspaceHint')}</p>
      </div>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={onCancel}>{t('common.cancel')}</Button>
        <Button type="submit" loading={saving} disabled={(project.workspaceId ?? '') === workspaceId}>{t('common.save')}</Button>
      </div>
    </form>
  );
}
