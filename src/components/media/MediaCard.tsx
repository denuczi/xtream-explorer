import { useState } from 'react';
import { Clapperboard, Star, Tv } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export type CardVariant = 'channel' | 'poster';

const FALLBACK_ICONS: Record<CardVariant, LucideIcon> = {
  channel: Tv,
  poster: Clapperboard,
};

interface MediaCardProps {
  title: string;
  imageUrl: string | null;
  variant: CardVariant;
  subtitle?: string | null;
  badge?: string | null;
  onClick?: () => void;
}

export function MediaCard({ title, imageUrl, variant, subtitle, badge, onClick }: MediaCardProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const FallbackIcon = FALLBACK_ICONS[variant];

  const showImage = imageUrl !== null && !imageFailed;

  const interactive = typeof onClick === 'function';
  const Wrapper = interactive ? 'button' : 'div';

  return (
    <Wrapper
      {...(interactive ? { type: 'button' as const, onClick } : {})}
      className={`group overflow-hidden rounded-xl border border-line bg-surface text-left transition ${
        interactive ? 'cursor-pointer hover:border-accent/60 hover:bg-surface-raised focus-visible:outline-2 focus-visible:outline-accent' : ''
      }`}
    >
      <div
        className={`relative flex w-full items-center justify-center bg-surface-raised ${
          variant === 'channel' ? 'aspect-video p-4' : 'aspect-[2/3] p-0'
        }`}
      >
        {showImage ? (
          <img
            src={imageUrl as string}
            alt=""
            loading="lazy"
            decoding="async"
            onError={() => setImageFailed(true)}
            className={`h-full w-full ${variant === 'channel' ? 'object-contain' : 'object-cover'}`}
          />
        ) : (
          <FallbackIcon className="h-10 w-10 text-zinc-600" aria-hidden />
        )}

        {badge !== undefined && badge !== null && badge.length > 0 && (
          <span className="absolute right-1.5 top-1.5 inline-flex items-center gap-1 rounded-md bg-app/85 px-1.5 py-0.5 text-[11px] font-semibold text-amber-300">
            <Star className="h-3 w-3" aria-hidden />
            {badge}
          </span>
        )}
      </div>

      <div className="px-2 py-2">
        <p className="line-clamp-2 min-h-[2rem] text-xs font-medium leading-tight text-zinc-100">
          {title.length > 0 ? title : '…'}
        </p>
        {subtitle !== undefined && subtitle !== null && subtitle.length > 0 && (
          <p className="mt-0.5 truncate text-[11px] text-zinc-500">{subtitle}</p>
        )}
      </div>
    </Wrapper>
  );
}
