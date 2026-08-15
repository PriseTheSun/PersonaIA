import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { MutationNotice } from '@/components/shared/inline-form';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { apiRequest, csrfHeaders } from '@/lib/api';
import { permissionSchema, type Project } from '@/lib/schemas';
import { FormField } from './form-field';
import { createUserFormSchema, type CreateUserFormInput } from './form-schemas';

export function CreateUserForm({ projects, onCreated, onCancel }: { projects: Project[]; onCreated: () => void; onCancel: () => void }) {
  const { t } = useTranslation();
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<CreateUserFormInput>({ resolver: zodResolver(createUserFormSchema), defaultValues: { name: '', email: '', password: '', projectIds: [], permission: 'VIEWER' } });
  const submit = handleSubmit(async (input) => { setError(null); try { await apiRequest('/users', z.unknown(), { method: 'POST', headers: csrfHeaders(), body: input }); onCreated(); } catch (cause) { setError(cause instanceof Error ? cause.message : t('forms.error')); } });
  return <form onSubmit={submit} className="space-y-5" noValidate><MutationNotice message={error} type="error" /><div className="grid gap-4 sm:grid-cols-2"><FormField id="user-name" label={t('common.name')} error={errors.name && t(errors.name.message!)} {...register('name')} /><FormField id="user-email" label={t('common.email')} type="email" autoComplete="username" error={errors.email && t(errors.email.message!)} {...register('email')} /><div className="sm:col-span-2"><FormField id="user-password" label={t('common.password')} type="password" autoComplete="new-password" error={errors.password && t(errors.password.message!)} {...register('password')} /><p className="mt-2 text-xs leading-5 text-muted-foreground">{t('forms.passwordHint')}</p></div></div><fieldset><legend className="text-sm font-medium">{t('forms.projects')}</legend><p className="mt-1 text-xs text-muted-foreground">{t('forms.projectsHint')}</p><div className="mt-3 grid gap-2 sm:grid-cols-2">{projects.map((project) => <label key={project.id} className="flex min-h-11 items-center gap-3 rounded-md border px-3 text-sm hover:bg-muted/50"><input type="checkbox" value={project.id} className="size-4 accent-primary" {...register('projectIds')} />{project.name}</label>)}</div></fieldset><div className="space-y-2"><Label htmlFor="user-permission">{t('forms.initialPermission')}</Label><select id="user-permission" className="h-10 w-full rounded-md border border-input bg-card px-3 text-base md:text-sm" {...register('permission')}>{permissionSchema.options.map((permission) => <option key={permission} value={permission}>{t(`permissions.permission.${permission}`)}</option>)}</select></div><div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={onCancel}>{t('common.cancel')}</Button><Button type="submit" loading={isSubmitting}>{t('users.invite')}</Button></div></form>;
}
