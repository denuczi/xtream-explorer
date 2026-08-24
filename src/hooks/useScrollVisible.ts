import { useEffect, useState } from 'react';
import { isBeyondScrollFraction } from '../lib/scroll';

/**
 * True while the window scroll has passed `fraction` of the scrollable
 * range. Only window scrolling counts — inner scrollers are ignored.
 * rAF-throttled so high-frequency scroll events never spam renders.
 */

// Re-evaluates visibility when scroll, viewport size or document height changes.
export function useScrollVisible(fraction = 0.2): boolean {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let frame: number | null = null;

    const check = (): void => {
      frame = null;
      setVisible(
        isBeyondScrollFraction(
          window.scrollY,
          window.innerHeight,
          document.documentElement.scrollHeight,
          fraction,
        ),
      );
    };

    const scheduleCheck = (): void => {
      if (frame === null) frame = requestAnimationFrame(check);
    };

    check();
    window.addEventListener('scroll', scheduleCheck, { passive: true });
    window.addEventListener('resize', scheduleCheck, { passive: true });

    // Observe document size changes so async content (catalog grids) triggers a re-check.
    const resizeObserver = new ResizeObserver(scheduleCheck);
    resizeObserver.observe(document.documentElement);
    if (document.body) resizeObserver.observe(document.body);

    const mutationObserver = new MutationObserver(scheduleCheck);
    mutationObserver.observe(document.documentElement, { childList: true, subtree: true });

    return () => {
      if (frame !== null) cancelAnimationFrame(frame);
      window.removeEventListener('scroll', scheduleCheck);
      window.removeEventListener('resize', scheduleCheck);
      resizeObserver.disconnect();
      mutationObserver.disconnect();
    };
  }, [fraction]);

  return visible;
}
