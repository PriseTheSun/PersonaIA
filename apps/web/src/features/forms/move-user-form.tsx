import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { MutationNotice } from '@/components/shared/inline-form';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { apiRequest, csrfHeaders } from '@/lib/api';
import { permissionSchema, type Project } from '@/lib/schemas';
import { moveUserFormSchema, type MoveUserFormInput } from './form-schemas';

interface Membership { permission: z.infer<typeof permissionSchema>; project: { id: string; name: string } }

export function MoveUserForm({ userId, memberships, projects, onMoved, onCancel }: { userId: string; memberships: Membership[]; projects: Project[]; onMoved: () => void; onCancel: () => void }) {
  const { t } = useTranslation();
  const [error, setError] = useState<string | null>(null);
  const first = memberships[0];
  const { register, handleSubmit, watch, setValue, formState: { errors, isSubmitting } } = useForm<MoveUserFormInput>({ resolver: zodResolver(moveUserFormSchema), defaultValues: { fromProjectId: first?.project.id ?? '', toProjectId: '', permission: first?.permission ?? 'VIEWER' } });
  const sourceId = watch('fromProjectId');
  useEffect(() => { const membership = memberships.find((item) => item.project.id === sourceId); if (membership) setValue('permission', membership.permission); }, [memberships, setValue, sourceId]);
  const submit = handleSubmit(async (input) => { setError(null); try { await apiRequest(`/projects/${encodeURIComponent(input.fromProjectId)}/members/move`, z.unknown(), { method: 'POST', headers: csrfHeaders(), body: { userId, toProjectId: input.toProjectId, permission: input.permission } }); onMoved(); } catch (cause) { setError(cause instanceof Error ? cause.message : t('forms.error')); } });
  return <form onSubmit={submit} className="space-y-5" noValidate><MutationNotice message={error} type="error" /><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="from-project">{t('forms.fromProject')}</Label><select id="from-project" className="h-10 w-full rounded-md border border-input bg-card px-3 text-base md:text-sm" {...register('fromProjectId')}>{memberships.map((membership) => <option key={membership.project.id} value={membership.project.id}>{membership.project.name}</option>)}</select></div><div className="space-y-2"><Label htmlFor="to-project">{t('forms.toProject')}</Label><select id="to-project" className="h-10 w-full rounded-md border border-input bg-card px-3 text-base md:text-sm" aria-invalid={Boolean(errors.toProjectId)} {...register('toProjectId')}><option value="">{t('forms.selectProject')}</option>{projects.filter((project) => project.id !== sourceId).map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select>{errors.toProjectId ? <p className="text-sm text-destructive" role="alert">{t(errors.toProjectId.message!)}</p> : null}</div></div><div className="space-y-2"><Label htmlFor="move-permission">{t('common.permissions')}</Label><select id="move-permission" className="h-10 w-full rounded-md border border-input bg-card px-3 text-base md:text-sm" {...register('permission')}>{permissionSchema.options.map((permission) => <option key={permission} value={permission}>{t(`permissions.permission.${permission}`)}</option>)}</select></div><div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={onCancel}>{t('common.cancel')}</Button><Button type="submit" loading={isSubmitting}>{t('forms.moveUser')}</Button></div></form>;
}
