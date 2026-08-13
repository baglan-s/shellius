import { useState, useCallback, ReactNode } from 'react';
import { I18nContext, Locale, TranslationKey, t as translate } from './index';

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => {
    const saved = localStorage.getItem('shellius_locale');
    return (saved as Locale) || 'en';
  });

  const setLocale = useCallback((newLocale: Locale) => {
    localStorage.setItem('shellius_locale', newLocale);
    setLocaleState(newLocale);
  }, []);

  const t = useCallback(
    (key: TranslationKey) => translate(locale, key),
    [locale]
  );

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  );
}
