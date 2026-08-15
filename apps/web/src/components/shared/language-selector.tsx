import { Languages } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { supportedLocales } from '@/i18n/resources';

const labels = { 'pt-BR': 'Português (BR)', es: 'Español', en: 'English' };

export function LanguageSelector({ showLabel = false }: { showLabel?: boolean }) {
  const { t, i18n } = useTranslation();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size={showLabel ? 'default' : 'icon'} aria-label={t('common.language')} className={showLabel ? 'justify-start' : undefined}>
          <Languages aria-hidden="true" />{showLabel ? labels[i18n.language as keyof typeof labels] ?? labels.en : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>{t('common.language')}</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={i18n.language} onValueChange={(locale) => void i18n.changeLanguage(locale)}>
          {supportedLocales.map((locale) => <DropdownMenuRadioItem key={locale} value={locale} lang={locale}>{labels[locale]}</DropdownMenuRadioItem>)}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
