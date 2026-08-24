import { createContext } from 'react';
import type { Dictionary, Locale } from './dictionaries';

export interface I18nContextValue {
  locale: Locale;
  t: Dictionary;
  setLocale: (locale: Locale) => void;
}

export const I18nContext = createContext<I18nContextValue | null>(null);
