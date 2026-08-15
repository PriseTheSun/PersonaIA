import { useTranslation } from 'react-i18next';

export function LoginBrandPanel() {
  const { t } = useTranslation();

  return (
    <aside className="m-3 hidden min-h-[626px] flex-col justify-between rounded-lg bg-foreground p-10 text-background lg:flex xl:p-12">
      <img src="/brand/favicon-personaia.svg" alt="PersonaIA" className="size-11 object-contain invert dark:invert-0" />
      <div className="max-w-sm">
        <p className="text-sm font-medium text-background/70">{t('auth.brandKicker')}</p>
        <p className="mt-3 text-3xl font-semibold leading-[1.16] tracking-[-0.035em]">{t('auth.brandStatement')}</p>
      </div>
    </aside>
  );
}
