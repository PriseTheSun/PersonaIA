import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { MutationNotice } from '@/components/shared/inline-form';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { apiRequest, csrfHeaders } from '@/lib/api';
import { FormField } from './form-field';
import { createProjectFormSchema, type CreateProjectFormInput } from './form-schemas';
import type { Workspace } from '@/lib/schemas';

export function CreateProjectForm({ tenantId, workspaces, defaultWorkspaceId, allowWithoutWorkspace, onCreated, onCancel }: { tenantId: string; workspaces: Workspace[]; defaultWorkspaceId?: string; allowWithoutWorkspace: boolean; onCreated: () => void; onCancel: () => void }) {
  const { t } = useTranslation();
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<CreateProjectFormInput>({ resolver: zodResolver(createProjectFormSchema), defaultValues: { workspaceId: defaultWorkspaceId ?? (!allowWithoutWorkspace ? workspaces[0]?.id : '') ?? '', name: '', description: '' } });
  const submit = handleSubmit(async (input) => { setError(null); try { await apiRequest('/projects', z.unknown(), { method: 'POST', headers: csrfHeaders(), body: { tenantId, ...(input.workspaceId ? { workspaceId: input.workspaceId } : {}), name: input.name, ...(input.description ? { description: input.description } : {}) } }); onCreated(); } catch (cause) { setError(cause instanceof Error ? cause.message : t('forms.error')); } });
  return <form onSubmit={submit} className="space-y-5" noValidate><MutationNotice message={error} type="error" /><div className="space-y-2"><Label htmlFor="project-workspace">{t('forms.projectWorkspace')}</Label><select id="project-workspace" className="h-10 w-full rounded-md border border-input bg-card px-3 text-base md:text-sm" aria-invalid={Boolean(errors.workspaceId)} {...register('workspaceId')}>{allowWithoutWorkspace ? <option value="">{t('forms.noWorkspace')}</option> : <option value="">{t('forms.selectWorkspace')}</option>}{workspaces.map((workspace) => <option key={workspace.id} value={workspace.id}>{workspace.name}</option>)}</select><p className="text-xs leading-5 text-muted-foreground">{t('forms.projectWorkspaceHint')}</p>{errors.workspaceId ? <p className="text-sm text-destructive">{t(errors.workspaceId.message!)}</p> : null}</div><FormField id="project-name" label={t('common.name')} error={errors.name && t(errors.name.message!)} {...register('name')} /><div className="space-y-2"><Label htmlFor="project-description">{t('forms.description')}</Label><textarea id="project-description" rows={4} maxLength={500} className="w-full resize-y rounded-md border border-input bg-card px-3 py-2 text-base placeholder:text-muted-foreground md:text-sm" {...register('description')} />{errors.description ? <p className="text-sm text-destructive">{t(errors.description.message!)}</p> : null}</div><div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button type="button" variant="outline" onClick={onCancel}>{t('common.cancel')}</Button><Button type="submit" loading={isSubmitting}>{t('projects.create')}</Button></div></form>;
}
