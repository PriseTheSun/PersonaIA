import { Check, Circle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { passwordRequirementChecks } from '@/lib/password-policy';
import { cn } from '@/lib/utils';

interface PasswordRequirementsProps {
  id?: string;
  password: string;
}

export function PasswordRequirements({ id, password }: PasswordRequirementsProps) {
  const { t } = useTranslation();

  return (
    <div id={id} className="rounded-md bg-muted/60 p-3">
      <p className="text-sm font-medium text-foreground">{t('preferences.passwordRequirements')}</p>
      <ul className="mt-2 grid gap-2 text-sm sm:grid-cols-2" aria-label={t('preferences.passwordRequirements')}>
        {passwordRequirementChecks.map((requirement) => {
          const met = requirement.test(password);
          const Icon = met ? Check : Circle;
          return (
            <li key={requirement.key} className={cn('flex items-center gap-2', met ? 'text-primary' : 'text-muted-foreground')}>
              <Icon className="size-4 shrink-0" aria-hidden="true" />
              <span>{t(`preferences.passwordRequirement.${requirement.key}`)}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
