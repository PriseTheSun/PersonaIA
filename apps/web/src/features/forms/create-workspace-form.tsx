import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { MutationNotice } from '@/components/shared/inline-form';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { apiRequest, csrfHeaders } from '@/lib/api';
import { createWorkspaceFormSchema, type CreateWorkspaceFormInput } from './form-schemas';
import { FormField } from './form-field';

export function CreateWorkspaceForm({ tenantId, onCreated, onCancel }: { tenantId: string; onCreated: () => void; onCancel: () => void }) {
  const { t } = useTranslation();
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<CreateWorkspaceFormInput>({ resolver: zodResolver(createWorkspaceFormSchema), defaultValues: { name: '', description: '' } });
  const submit = handleSubmit(async (input) => {
    setError(null);
    try {
      await apiRequest(`/tenants/${encodeURIComponent(tenantId)}/workspaces`, z.unknown(), { method: 'POST', headers: csrfHeaders(), body: input });
      onCreated();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('forms.error'));
    }
  });
  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      <MutationNotice message={error} type="error" />
      <FormField id="workspace-name" label={t('common.name')} error={errors.name && t(errors.name.message!)} {...register('name')} />
      <div className="space-y-2"><Label htmlFor="workspace-description">{t('forms.description')}</Label><textarea id="workspace-description" rows={4} maxLength={500} className="w-full resize-y rounded-md border border-input bg-card px-3 py-2 text-base placeholder:text-muted-foreground md:text-sm" {...register('description')} /></div>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button type="button" variant="outline" onClick={onCancel}>{t('common.cancel')}</Button><Button type="submit" loading={isSubmitting}>{t('workspaces.create')}</Button></div>
    </form>
  );
}
