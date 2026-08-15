import { useTranslation } from 'react-i18next';

export function AuthBrandPanel() {
  const { t } = useTranslation();

  return (
    <aside className="m-3 hidden min-h-[626px] flex-col justify-between rounded-lg bg-secondary p-10 text-secondary-foreground lg:flex xl:p-12">
      <img src="/brand/favicon-personaia.svg" alt="PersonaIA" className="size-11 object-contain invert" />
      <div className="max-w-sm">
        <p className="text-sm font-medium text-secondary-foreground/70">{t('auth.brandKicker')}</p>
        <p className="mt-3 text-3xl font-semibold leading-[1.16] tracking-[-0.035em]">{t('auth.brandStatement')}</p>
      </div>
    </aside>
  );
}
