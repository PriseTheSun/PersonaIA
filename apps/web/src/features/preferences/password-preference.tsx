import { zodResolver } from '@hookform/resolvers/zod';
import { KeyRound } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { z } from 'zod';
import { MutationNotice } from '@/components/shared/inline-form';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { PasswordInput } from '@/features/auth/password-input';
import { PasswordRequirements } from '@/features/auth/password-requirements';
import { useAuth } from '@/features/auth/auth-store';
import { ApiError, apiRequest, csrfHeaders } from '@/lib/api';
import { changePasswordFormSchema, type ChangePasswordFormInput } from './preferences-schemas';

const responseSchema = z.object({ success: z.literal(true), requiresLogin: z.literal(true) });

export function PasswordPreference() {
  const { t } = useTranslation();
  const auth = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm<ChangePasswordFormInput>({
    resolver: zodResolver(changePasswordFormSchema),
    defaultValues: { newPassword: '', confirmPassword: '' },
  });
  const newPassword = watch('newPassword');

  const submit = handleSubmit(async ({ newPassword: password }) => {
    setError(null);
    try {
      await apiRequest('/preferences/password', responseSchema, {
        method: 'PATCH',
        headers: csrfHeaders(),
        body: { newPassword: password },
      });
      toast.success(t('preferences.passwordUpdated'));
      await auth.logout();
      navigate('/login', { replace: true });
    } catch (cause) {
      if (cause instanceof ApiError && cause.code === 'PASSWORD_UNCHANGED') {
        setError(t('preferences.passwordUnchanged'));
      } else {
        setError(t('preferences.passwordError'));
      }
    }
  });

  const field = (id: string, label: string, registration: ReturnType<typeof register>, message?: string) => (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <PasswordInput id={id} autoComplete="new-password" aria-invalid={Boolean(message)} aria-describedby={[id === 'new-password' ? 'password-requirements' : '', message ? `${id}-error` : ''].filter(Boolean).join(' ') || undefined} {...registration} />
      {message ? <p id={`${id}-error`} className="text-sm text-destructive" role="alert">{message}</p> : null}
    </div>
  );

  return (
    <section className="w-full rounded-lg border bg-card p-4 sm:p-6" aria-labelledby="password-title">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-foreground"><KeyRound aria-hidden="true" className="size-4" /></span>
        <div>
          <h2 id="password-title" className="font-semibold">{t('preferences.passwordTitle')}</h2>
          <p className="mt-1 max-w-[65ch] text-sm leading-6 text-muted-foreground">{t('preferences.passwordDescription')}</p>
        </div>
      </div>
      <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
        <MutationNotice message={error} type="error" />
        <div className="grid gap-4 sm:grid-cols-2">
          {field('new-password', t('preferences.newPassword'), register('newPassword'), errors.newPassword && t(errors.newPassword.message!))}
          {field('confirm-password', t('preferences.confirmNewPassword'), register('confirmPassword'), errors.confirmPassword && t(errors.confirmPassword.message!))}
        </div>
        <PasswordRequirements id="password-requirements" password={newPassword} />
        <div className="flex justify-end pt-1">
          <Button type="submit" loading={isSubmitting}>{t('preferences.changePassword')}</Button>
        </div>
      </form>
    </section>
  );
}
