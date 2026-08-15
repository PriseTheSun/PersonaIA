import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { MutationNotice } from '@/components/shared/inline-form';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { apiRequest, csrfHeaders } from '@/lib/api';
import { type Tenant } from '@/lib/schemas';
import { FormField } from './form-field';
import { createAdminFormSchema, type CreateAdminFormInput } from './form-schemas';

export function CreateAdminForm({ tenants, onCreated, onCancel }: { tenants: Tenant[]; onCreated: () => void; onCancel: () => void }) {
  const { t } = useTranslation();
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<CreateAdminFormInput>({ resolver: zodResolver(createAdminFormSchema), defaultValues: { tenantId: '', name: '', email: '', password: '' } });
  const submit = handleSubmit(async (input) => { setError(null); try { await apiRequest('/client-admins', z.unknown(), { method: 'POST', headers: csrfHeaders(), body: input }); onCreated(); } catch (cause) { setError(cause instanceof Error ? cause.message : t('forms.error')); } });
  return <form onSubmit={submit} className="space-y-5" noValidate><MutationNotice message={error} type="error" /><div className="space-y-2"><Label htmlFor="admin-tenant">{t('common.tenant')}</Label><select id="admin-tenant" className="h-10 w-full rounded-md border border-input bg-card px-3 text-base md:text-sm" aria-invalid={Boolean(errors.tenantId)} {...register('tenantId')}><option value="">{t('forms.selectTenant')}</option>{tenants.map((tenant) => <option value={tenant.id} key={tenant.id}>{tenant.name}</option>)}</select>{errors.tenantId ? <p className="text-sm text-destructive" role="alert">{t(errors.tenantId.message!)}</p> : null}</div><div className="grid gap-4 sm:grid-cols-2"><FormField id="new-admin-name" label={t('common.name')} error={errors.name && t(errors.name.message!)} {...register('name')} /><FormField id="new-admin-email" label={t('common.email')} type="email" autoComplete="username" error={errors.email && t(errors.email.message!)} {...register('email')} /><div className="sm:col-span-2"><FormField id="new-admin-password" label={t('common.password')} type="password" autoComplete="new-password" error={errors.password && t(errors.password.message!)} {...register('password')} /><p className="mt-2 text-xs leading-5 text-muted-foreground">{t('forms.passwordHint')}</p></div></div><div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={onCancel}>{t('common.cancel')}</Button><Button type="submit" loading={isSubmitting}>{t('admins.create')}</Button></div></form>;
}
