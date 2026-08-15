import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { MutationNotice } from '@/components/shared/inline-form';
import { Button } from '@/components/ui/button';
import { apiRequest, csrfHeaders } from '@/lib/api';
import { FormField } from './form-field';
import { createTenantFormSchema, type CreateTenantFormInput } from './form-schemas';

export function CreateTenantForm({ onCreated, onCancel }: { onCreated: () => void; onCancel: () => void }) {
  const { t } = useTranslation();
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<CreateTenantFormInput>({ resolver: zodResolver(createTenantFormSchema), defaultValues: { name: '', slug: '', adminName: '', adminEmail: '', adminPassword: '' } });
  const submit = handleSubmit(async (input) => {
    setError(null);
    try {
      await apiRequest('/tenants', z.unknown(), { method: 'POST', headers: csrfHeaders(), body: { name: input.name, slug: input.slug, admin: { name: input.adminName, email: input.adminEmail, password: input.adminPassword } } });
      onCreated();
    } catch (cause) { setError(cause instanceof Error ? cause.message : t('forms.error')); }
  });
  return <form onSubmit={submit} className="space-y-5" noValidate><MutationNotice message={error} type="error" /><div className="grid gap-4 sm:grid-cols-2"><FormField id="tenant-name" label={t('forms.tenantName')} error={errors.name && t(errors.name.message!)} {...register('name')} /><FormField id="tenant-slug" label={t('forms.slug')} error={errors.slug && t(errors.slug.message!)} placeholder="empresa-exemplo" autoCapitalize="none" {...register('slug')} /></div><div className="border-t pt-5"><h3 className="mb-4 text-sm font-semibold">{t('forms.initialAdmin')}</h3><div className="grid gap-4 sm:grid-cols-2"><FormField id="admin-name" label={t('common.name')} error={errors.adminName && t(errors.adminName.message!)} {...register('adminName')} /><FormField id="admin-email" label={t('common.email')} type="email" autoComplete="username" error={errors.adminEmail && t(errors.adminEmail.message!)} {...register('adminEmail')} /><div className="sm:col-span-2"><FormField id="admin-password" label={t('common.password')} type="password" autoComplete="new-password" error={errors.adminPassword && t(errors.adminPassword.message!)} {...register('adminPassword')} /><p className="mt-2 text-xs leading-5 text-muted-foreground">{t('forms.passwordHint')}</p></div></div></div><div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={onCancel}>{t('common.cancel')}</Button><Button type="submit" loading={isSubmitting}>{t('tenants.create')}</Button></div></form>;
}
