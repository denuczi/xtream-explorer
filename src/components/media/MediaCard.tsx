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
      title={title}
      className={`group overflow-hidden rounded-[10px] border border-line bg-surface text-left transition ${
        interactive ? 'cursor-pointer hover:border-white/15 hover:bg-hover' : ''
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
          <FallbackIcon className="h-8 w-8 text-white/20" aria-hidden />
        )}

        {badge !== undefined && badge !== null && badge.length > 0 && (
          <span className="absolute right-1.5 top-1.5 inline-flex items-center gap-1 rounded-md bg-black/75 px-1.5 py-0.5 text-[11px] font-medium text-white backdrop-blur">
            <Star className="h-3 w-3 text-white/80" aria-hidden />
            {badge}
          </span>
        )}
      </div>

      <div className="px-2.5 py-2.5">
        <p
          title={title.length > 0 ? title : undefined}
          className="line-clamp-2 min-h-[2rem] cursor-pointer text-[13px] font-medium leading-tight text-white"
        >
          {title.length > 0 ? title : '…'}
        </p>
        {subtitle !== undefined && subtitle !== null && subtitle.length > 0 && (
          <p title={subtitle} className="mt-1 cursor-pointer truncate text-[11px] text-white/46">
            {subtitle}
          </p>
        )}
      </div>
    </Wrapper>
  );
}
