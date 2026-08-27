import { useI18n } from '../../i18n/useI18n';
import type { Locale } from '../../i18n/dictionaries';

const LOCALES: readonly Locale[] = ['en', 'es'];

export function LanguageSwitcher() {
  const { locale, setLocale, t } = useI18n();

  return (
    <div
      role="group"
      aria-label={t.language.label}
      className="flex items-center rounded-full border border-line bg-surface p-0.5"
    >
      {LOCALES.map((code) => {
        const isActive = locale === code;
        return (
          <button
            key={code}
            type="button"
            aria-pressed={isActive}
            onClick={() => setLocale(code)}
            className={`rounded-full px-2.5 py-1 text-xs font-medium transition ${
              isActive ? 'bg-white text-app' : 'text-white/50 hover:text-white'
            }`}
          >
            {t.language[code]}
          </button>
        );
      })}
    </div>
  );
}
