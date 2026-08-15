import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { MutationNotice } from '@/components/shared/inline-form';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { apiRequest, csrfHeaders } from '@/lib/api';
import { createAssetFormSchema, type CreateAssetFormInput } from './form-schemas';
import { FormField } from './form-field';

export function AssetForm({ path, initial, extraBody, submitLabel, onSaved, onCancel }: { path: string; initial?: CreateAssetFormInput; extraBody?: Record<string, unknown>; submitLabel: string; onSaved: () => void; onCancel: () => void }) {
  const { t } = useTranslation();
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<CreateAssetFormInput>({ resolver: zodResolver(createAssetFormSchema), defaultValues: initial ?? { name: '', description: '' } });
  const submit = handleSubmit(async (input) => {
    setError(null);
    try {
      await apiRequest(path, z.unknown(), { method: initial ? 'PATCH' : 'POST', headers: csrfHeaders(), body: { ...input, ...extraBody } });
      onSaved();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('forms.error'));
    }
  });
  return <form onSubmit={submit} className="space-y-5" noValidate><MutationNotice message={error} type="error" /><FormField id="asset-name" label={t('common.name')} error={errors.name && t(errors.name.message!)} {...register('name')} /><div className="space-y-2"><Label htmlFor="asset-description">{t('forms.description')}</Label><textarea id="asset-description" rows={4} maxLength={1000} className="w-full resize-y rounded-md border border-input bg-card px-3 py-2 text-base md:text-sm" {...register('description')} /></div><div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button type="button" variant="outline" onClick={onCancel}>{t('common.cancel')}</Button><Button type="submit" loading={isSubmitting}>{submitLabel}</Button></div></form>;
}
