import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { dictionaries, type Locale } from './dictionaries';
import { I18nContext } from './context';

const LANGUAGE_STORAGE_KEY = 'xtream-checker:language';

function isLocale(value: unknown): value is Locale {
  return value === 'en' || value === 'es';
}

function detectInitialLocale(): Locale {
  if (typeof window === 'undefined') return 'en';
  try {
    const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (isLocale(stored)) return stored;
  } catch {
    // Storage can be unavailable (private mode); fall back silently.
  }
  return window.navigator.language.toLowerCase().startsWith('es') ? 'es' : 'en';
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(detectInitialLocale);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = useCallback((next: Locale) => {
    try {
      window.localStorage.setItem(LANGUAGE_STORAGE_KEY, next);
    } catch {
      // Persisting the preference is best-effort only.
    }
    setLocaleState(next);
  }, []);

  const value = useMemo(
    () => ({ locale, t: dictionaries[locale], setLocale }),
    [locale, setLocale],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}
