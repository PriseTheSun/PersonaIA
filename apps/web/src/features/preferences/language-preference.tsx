import { Globe2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { LanguageSelector } from '@/components/shared/language-selector';

export function LanguagePreference() {
  const { t } = useTranslation();

  return (
    <section className="w-full rounded-lg border bg-card p-4 sm:p-6" aria-labelledby="language-title">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-foreground">
            <Globe2 aria-hidden="true" className="size-4" />
          </span>
          <div>
            <h2 id="language-title" className="font-semibold">{t('preferences.languageTitle')}</h2>
            <p className="mt-1 max-w-[65ch] text-sm leading-6 text-muted-foreground">{t('preferences.languageDescription')}</p>
          </div>
        </div>
        <div className="w-full shrink-0 sm:w-auto">
          <LanguageSelector showLabel variant="outline" />
        </div>
      </div>
    </section>
  );
}
