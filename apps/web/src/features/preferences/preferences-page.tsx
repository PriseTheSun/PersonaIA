import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/components/shared/page-header';
import { useAuth } from '@/features/auth/auth-store';
import { AvatarPreference } from './avatar-preference';
import { LanguagePreference } from './language-preference';
import { PasswordPreference } from './password-preference';
import { useCurrentAvatar } from './use-current-avatar';

export function PreferencesPage() {
  const { t } = useTranslation();
  const auth = useAuth();
  const user = auth.status === 'authenticated' ? auth.user : null;
  const avatarUrl = useCurrentAvatar(user?.hasAvatar, user?.avatarUpdatedAt);

  useEffect(() => { document.title = `${t('preferences.title')} · ${t('common.appName')}`; }, [t]);
  if (!user) return null;

  return (
    <div className="space-y-6">
      <PageHeader title={t('preferences.title')} description={t('preferences.description')} />
      <div className="flex w-full flex-col gap-5">
        <LanguagePreference />
        <AvatarPreference
          name={user.name}
          email={user.email}
          avatarUrl={avatarUrl}
          hasAvatar={Boolean(user.hasAvatar)}
          onChanged={auth.refresh}
        />
        <PasswordPreference />
      </div>
    </div>
  );
}
