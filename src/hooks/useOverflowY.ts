import { useEffect, useRef, useState, type RefObject } from 'react';

/** True when the element's content overflows vertically. */
export function useOverflowY<T extends HTMLElement>(): [RefObject<T | null>, boolean] {
  const ref = useRef<T>(null);
  const [overflowing, setOverflowing] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (element === null) return;

    const check = (): void => {
      setOverflowing(element.scrollHeight > element.clientHeight + 1);
    };

    check();
    const resizeObserver = new ResizeObserver(check);
    resizeObserver.observe(element);
    // Content swaps (loading → list) change scrollHeight without resizing the box.
    const mutationObserver = new MutationObserver(check);
    mutationObserver.observe(element, { childList: true, subtree: true });
    window.addEventListener('resize', check);

    return () => {
      resizeObserver.disconnect();
      mutationObserver.disconnect();
      window.removeEventListener('resize', check);
    };
  }, []);

  return [ref, overflowing];
}
