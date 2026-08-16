import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { MutationNotice } from '@/components/shared/inline-form';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { PasswordInput } from '@/features/auth/password-input';
import { apiRequest, csrfHeaders } from '@/lib/api';
import { FormField } from './form-field';
import { createTenantFormSchema, type CreateTenantFormInput } from './form-schemas';

export function CreateTenantForm({ onCreated, onCancel }: { onCreated: () => void; onCancel: () => void }) {
  const { t } = useTranslation();
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<CreateTenantFormInput>({ resolver: zodResolver(createTenantFormSchema), defaultValues: { name: '', segment: '', description: '', adminName: '', adminEmail: '', adminPassword: '' } });
  const submit = handleSubmit(async (input) => {
    setError(null);
    try {
      await apiRequest('/tenants', z.unknown(), { method: 'POST', headers: csrfHeaders(), body: { name: input.name, segment: input.segment, ...(input.description ? { description: input.description } : {}), admin: { name: input.adminName, email: input.adminEmail, password: input.adminPassword } } });
      onCreated();
    } catch (cause) { setError(cause instanceof Error ? cause.message : t('forms.error')); }
  });
  const descriptionError = errors.description ? t(errors.description.message!) : undefined;

  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      <MutationNotice message={error} type="error" />
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="tenant-name" label={t('forms.tenantName')} error={errors.name && t(errors.name.message!)} {...register('name')} />
        <FormField id="tenant-segment" label={t('forms.segment')} error={errors.segment && t(errors.segment.message!)} {...register('segment')} />
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="tenant-description">{t('forms.description')}</Label>
          <Textarea
            id="tenant-description"
            rows={4}
            maxLength={500}
            aria-invalid={Boolean(descriptionError)}
            aria-describedby={descriptionError ? 'tenant-description-error' : undefined}
            {...register('description')}
          />
          {descriptionError ? <p id="tenant-description-error" className="text-sm text-destructive" role="alert">{descriptionError}</p> : null}
        </div>
      </div>
      <div className="border-t pt-5">
        <h3 className="mb-4 text-sm font-semibold">{t('forms.initialAdmin')}</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField id="admin-name" label={t('common.name')} error={errors.adminName && t(errors.adminName.message!)} {...register('adminName')} />
          <FormField id="admin-email" label={t('common.email')} type="email" autoComplete="username" error={errors.adminEmail && t(errors.adminEmail.message!)} {...register('adminEmail')} />
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="admin-password">{t('common.password')}</Label>
            <PasswordInput
              id="admin-password"
              autoComplete="new-password"
              aria-invalid={Boolean(errors.adminPassword)}
              aria-describedby={errors.adminPassword ? 'admin-password-error admin-password-hint' : 'admin-password-hint'}
              {...register('adminPassword')}
            />
            {errors.adminPassword ? <p id="admin-password-error" className="text-sm text-destructive" role="alert">{t(errors.adminPassword.message!)}</p> : null}
            <p id="admin-password-hint" className="text-xs leading-5 text-muted-foreground">{t('forms.passwordHint')}</p>
          </div>
        </div>
      </div>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={onCancel}>{t('common.cancel')}</Button>
        <Button type="submit" loading={isSubmitting}>{t('tenants.create')}</Button>
      </div>
    </form>
  );
}
