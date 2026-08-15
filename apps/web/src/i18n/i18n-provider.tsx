import i18n from 'i18next';
import { initReactI18next, I18nextProvider } from 'react-i18next';
import { type PropsWithChildren, useEffect, useMemo } from 'react';
import { resources, supportedLocales, type AppLocale } from './resources';

const STORAGE_KEY = 'personaia.locale';

function resolveLocale(): AppLocale {
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored && supportedLocales.includes(stored as AppLocale)) return stored as AppLocale;
  const browserLocale = navigator.language.toLowerCase();
  if (browserLocale.startsWith('pt')) return 'pt-BR';
  if (browserLocale.startsWith('es')) return 'es';
  return 'en';
}

export function I18nProvider({ children }: PropsWithChildren) {
  const instance = useMemo(() => {
    const next = i18n.createInstance();
    void next.use(initReactI18next).init({
      resources,
      lng: resolveLocale(),
      fallbackLng: 'pt-BR',
      interpolation: { escapeValue: false },
      returnNull: false,
    });
    return next;
  }, []);

  useEffect(() => {
    const updateDocument = (locale: string) => {
      document.documentElement.lang = locale;
      window.localStorage.setItem(STORAGE_KEY, locale);
    };
    updateDocument(instance.language);
    instance.on('languageChanged', updateDocument);
    return () => instance.off('languageChanged', updateDocument);
  }, [instance]);

  return <I18nextProvider i18n={instance}>{children}</I18nextProvider>;
}
