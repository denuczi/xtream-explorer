import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { useI18n } from '../../i18n/useI18n';
import type { StreamFormat } from '../../types/models';

interface StreamFormatSelectProps {
  value: StreamFormat;
  onChange: (value: StreamFormat) => void;
  disabled?: boolean;
}

export function StreamFormatSelect({ value, onChange, disabled = false }: StreamFormatSelectProps) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const options: { value: StreamFormat; label: string }[] = [
    { value: 'ts', label: t.connection.formatTs },
    { value: 'm3u8', label: t.connection.formatM3u8 },
  ];

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(event: MouseEvent): void {
      if (rootRef.current !== null && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape') setOpen(false);
    }
    window.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  const currentLabel = options.find((option) => option.value === value)?.label ?? value;

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        id="xtream-format"
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabled}
        title={currentLabel}
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full cursor-pointer items-center justify-between gap-2 rounded-[10px] border border-line bg-surface px-3 py-2 text-left text-[13px] text-white outline-none transition focus:border-white/20 focus:ring-2 focus:ring-white/10 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <span>{currentLabel}</span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-white/40 transition-transform ${open ? 'rotate-180' : ''}`}
          aria-hidden
        />
      </button>

      {open && (
        <div
          role="listbox"
          aria-label={t.connection.streamFormat}
          className="absolute left-0 right-0 z-30 mt-1 overflow-hidden rounded-[10px] border border-line bg-surface p-1 shadow-xl backdrop-blur"
        >
          {options.map((option) => {
            const isActive = option.value === value;
            return (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={isActive}
                title={option.label}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
                className={`flex w-full cursor-pointer items-center justify-between rounded-[8px] px-3 py-1.5 text-left text-[13px] transition ${
                  isActive ? 'bg-white text-app' : 'text-white/70 hover:bg-hover hover:text-white'
                }`}
              >
                {option.label}
                {isActive && <Check className="h-3.5 w-3.5" aria-hidden />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
