import { createContext, useContext } from 'react';
import { en } from './en';
import { ru } from './ru';
import { kk } from './kk';

export type Locale = 'en' | 'ru' | 'kk';
export type TranslationKey = keyof typeof en;

const translations: Record<Locale, Record<string, string>> = { en, ru, kk };

export function t(locale: Locale, key: TranslationKey): string {
  return translations[locale]?.[key] || translations.en[key] || key;
}

export interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: TranslationKey) => string;
}

export const I18nContext = createContext<I18nContextValue>({
  locale: 'en',
  setLocale: () => {},
  t: (key) => en[key] || key,
});

export function useI18n() {
  return useContext(I18nContext);
}
