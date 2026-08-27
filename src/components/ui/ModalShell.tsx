import { useCallback, useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface ModalShellProps {
  onClose: () => void;
  /** Accessible name for the dialog (either label or labelledBy is required). */
  ariaLabel?: string;
  labelledBy?: string;
  maxWidthClass?: string;
  children: ReactNode;
}

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

/**
 * Shared modal foundation: portal, backdrop, Escape/backdrop dismissal,
 * body scroll lock, Tab focus-trap and focus restoration to the trigger.
 * All modals in the app must render through this shell for coherent UX.
 */
export function ModalShell({
  onClose,
  ariaLabel,
  labelledBy,
  maxWidthClass = 'max-w-xl',
  children,
}: ModalShellProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    restoreFocusRef.current = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
      restoreFocusRef.current?.focus();
    };
  }, []);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
        return;
      }
      // Focus trap: keep Tab cycling inside the dialog.
      if (event.key !== 'Tab') return;
      const root = dialogRef.current;
      if (root === null) return;

      const focusables = Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
        (element) => element.getClientRects().length > 0,
      );

      if (focusables.length === 0) {
        event.preventDefault();
        root.focus();
        return;
      }

      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (first === undefined || last === undefined) return;

      const active = document.activeElement as HTMLElement | null;
      const isInside = active !== null && root.contains(active);

      if (event.shiftKey && (!isInside || active === first)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (!isInside || active === last)) {
        event.preventDefault();
        first.focus();
      }
    },
    [onClose],
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return createPortal(
    <div
      className="animate-backdrop-fade fixed inset-0 z-50 overflow-y-auto bg-black/80 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className={`mx-auto my-[6vh] w-full px-4 ${maxWidthClass}`} role="presentation">
        <div
          ref={dialogRef}
          tabIndex={-1}
          role="dialog"
          aria-modal="true"
          aria-label={ariaLabel}
          aria-labelledby={labelledBy}
          className="animate-modal-pop overflow-hidden rounded-[12px] border border-white/10 bg-surface shadow-2xl outline-none"
        >
          {children}
        </div>
      </div>
    </div>,
    document.body,
  );
}
