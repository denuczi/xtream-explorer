import { useEffect, useState } from 'react';
import { isBeyondScrollFraction } from '../lib/scroll';

/**
 * True while the window scroll has passed `fraction` of the scrollable
 * range. Only window scrolling counts — inner scrollers are ignored.
 * rAF-throttled so high-frequency scroll events never spam renders.
 */
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

    const onScroll = (): void => {
      if (frame === null) frame = requestAnimationFrame(check);
    };

    check();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });

    return () => {
      if (frame !== null) cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [fraction]);

  return visible;
}
