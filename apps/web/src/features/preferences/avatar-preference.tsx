import { Camera, Trash2, Upload } from 'lucide-react';
import { type ChangeEvent, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { z } from 'zod';
import { Avatar } from '@/components/shared/avatar';
import { MutationNotice } from '@/components/shared/inline-form';
import { Button } from '@/components/ui/button';
import { apiRequest, apiVoid, csrfHeaders } from '@/lib/api';

const avatarResponseSchema = z.object({ hasAvatar: z.literal(true), avatarUpdatedAt: z.string().datetime() });
const MAX_AVATAR_BYTES = 700 * 1024;
const ACCEPTED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png']);

function readAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('INVALID_FILE_RESULT'));
    reader.onerror = () => reject(reader.error ?? new Error('FILE_READ_FAILED'));
    reader.readAsDataURL(file);
  });
}

export function AvatarPreference({
  name,
  email,
  avatarUrl,
  hasAvatar,
  onChanged,
}: {
  name: string;
  email: string;
  avatarUrl: string | null;
  hasAvatar: boolean;
  onChanged: () => Promise<void>;
}) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const upload = async (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;
    setError(null);
    if (!ACCEPTED_IMAGE_TYPES.has(file.type)) {
      setError(t('preferences.invalidPhotoType'));
      input.value = '';
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      setError(t('preferences.photoTooLarge'));
      input.value = '';
      return;
    }
    setBusy(true);
    try {
      const image = await readAsDataUrl(file);
      await apiRequest('/preferences/avatar', avatarResponseSchema, { method: 'PUT', headers: csrfHeaders(), body: { image } });
      await onChanged();
      toast.success(t('preferences.photoUpdated'));
    } catch {
      setError(t('preferences.photoError'));
    } finally {
      setBusy(false);
      input.value = '';
    }
  };

  const remove = async () => {
    setError(null);
    setBusy(true);
    try {
      await apiVoid('/preferences/avatar', { method: 'DELETE', headers: csrfHeaders() });
      await onChanged();
      toast.success(t('preferences.photoRemoved'));
    } catch {
      setError(t('preferences.photoRemoveError'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-lg border bg-card p-4 sm:p-6" aria-labelledby="profile-photo-title">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-foreground"><Camera aria-hidden="true" className="size-4" /></span>
        <div>
          <h2 id="profile-photo-title" className="font-semibold">{t('preferences.profileTitle')}</h2>
          <p className="mt-1 max-w-[65ch] text-sm leading-6 text-muted-foreground">{t('preferences.profileDescription')}</p>
        </div>
      </div>
      <div className="mt-6 flex flex-col gap-5 sm:flex-row sm:items-center">
        <Avatar name={name} src={avatarUrl} alt={t('preferences.photoAlt', { name })} className="size-20 text-lg" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{name}</p>
          <p className="mt-0.5 truncate text-sm text-muted-foreground">{email}</p>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">{t('preferences.photoHint')}</p>
        </div>
      </div>
      <div className="mt-5"><MutationNotice message={error} type="error" /></div>
      <input ref={inputRef} className="sr-only" type="file" accept="image/png,image/jpeg" onChange={(event) => { void upload(event); }} aria-label={t('preferences.choosePhoto')} />
      <div className="mt-5 flex flex-col gap-2 sm:flex-row">
        <Button type="button" variant="outline" loading={busy} onClick={() => inputRef.current?.click()}>
          <Upload aria-hidden="true" />{t(hasAvatar ? 'preferences.changePhoto' : 'preferences.choosePhoto')}
        </Button>
        {hasAvatar ? <Button type="button" variant="ghost" disabled={busy} onClick={() => { void remove(); }}><Trash2 aria-hidden="true" />{t('preferences.removePhoto')}</Button> : null}
      </div>
    </section>
  );
}
