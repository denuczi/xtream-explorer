import { RotateCcw } from 'lucide-react';
import { useI18n } from '../../i18n/useI18n';

export function GridSkeleton({
  count = 12,
  variant = 'poster',
}: {
  count?: number;
  variant?: 'poster' | 'channel';
}) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
      {Array.from({ length: count }, (_, index) => (
        <div
          key={index}
          className="animate-pulse overflow-hidden rounded-[10px] border border-line bg-surface"
        >
          <div
            className={`w-full bg-surface-raised ${variant === 'channel' ? 'aspect-video' : 'aspect-[2/3]'}`}
          />
          <div className="space-y-1.5 px-2.5 py-2.5">
            <div className="h-2.5 w-4/5 rounded bg-white/10" />
            <div className="h-2 w-2/5 rounded bg-white/10" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function RailSkeleton({ count = 10 }: { count?: number }) {
  return (
    <div className="flex flex-row gap-1.5 lg:flex-col">
      {Array.from({ length: count }, (_, index) => (
        <div
          key={index}
          className="h-9 w-32 shrink-0 animate-pulse rounded-[10px] bg-surface lg:w-full"
        />
      ))}
    </div>
  );
}

export function ErrorState({
  onRetry,
  compact = false,
}: {
  onRetry: () => void;
  compact?: boolean;
}) {
  const { t } = useI18n();

  if (compact) {
    return (
      <p role="alert" className="px-1 py-2 text-xs text-red-300">
        {t.catalog.loadError}{' '}
        <button
          type="button"
          onClick={onRetry}
          className="font-semibold underline underline-offset-2 hover:text-red-200"
        >
          {t.catalog.retry}
        </button>
      </p>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center rounded-[12px] border border-line bg-surface px-6 py-14 text-center">
      <p role="alert" className="text-[13px] text-white">
        {t.catalog.loadError}
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-4 inline-flex items-center gap-2 rounded-[10px] border border-line bg-surface px-4 py-2 text-[13px] font-medium text-white transition hover:bg-hover"
      >
        <RotateCcw className="h-4 w-4" aria-hidden />
        {t.catalog.retry}
      </button>
    </div>
  );
}

export function EmptyState() {
  const { t } = useI18n();
  return (
    <div className="flex items-center justify-center rounded-[12px] border border-line bg-surface px-6 py-14 text-center">
      <p className="text-[13px] text-white/46">{t.catalog.empty}</p>
    </div>
  );
}

export function DetailSkeleton() {
  return (
    <div className="flex animate-pulse flex-col gap-6 sm:flex-row">
      <div className="aspect-[2/3] w-44 shrink-0 rounded-[12px] bg-surface" />
      <div className="flex-1 space-y-3">
        <div className="h-5 w-2/3 rounded bg-white/10" />
        <div className="h-3 w-1/3 rounded bg-white/10" />
        <div className="h-3 w-full rounded bg-white/10" />
        <div className="h-3 w-5/6 rounded bg-white/10" />
      </div>
    </div>
  );
}
