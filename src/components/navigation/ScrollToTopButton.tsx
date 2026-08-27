import { ArrowUp } from 'lucide-react';
import { useI18n } from '../../i18n/useI18n';
import { useScrollVisible } from '../../hooks/useScrollVisible';

/** Subtle bottom-right shortcut back to the top after 20% of page scroll. */
export function ScrollToTopButton() {
  const { t } = useI18n();
  const visible = useScrollVisible(0.2);

  function handleClick(): void {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: 0, behavior: prefersReducedMotion ? 'auto' : 'smooth' });
  }

  return (
    <button
      type="button"
      aria-label={t.common.backToTop}
      title={t.common.backToTop}
      tabIndex={visible ? 0 : -1}
      onClick={handleClick}
      className={`fixed bottom-6 right-6 z-40 rounded-full border border-line bg-surface p-3 text-white/70 shadow-lg transition-all duration-200 hover:bg-hover hover:text-white ${
        visible ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-2 opacity-0'
      }`}
    >
      <ArrowUp className="h-5 w-5" aria-hidden />
    </button>
  );
}
