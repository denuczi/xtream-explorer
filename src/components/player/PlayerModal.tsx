import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AlertTriangle, ArrowRight, Copy, Download, Loader2, X } from 'lucide-react';
import { useI18n } from '../../i18n/useI18n';
import { usePlayerStore } from '../../stores/player-store';
import { useConnectionStore } from '../../stores/connection-store';
import { ApiError, getPlayable, getVodDetail } from '../../lib/api';
import type { StreamTargets, VodDetail } from '../../types/models';
import { copyTextToClipboard } from '../../lib/clipboard';
import { ModalShell } from '../ui/ModalShell';
import { VideoStage } from './VideoStage';

type Loadable<T> = { status: 'idle' | 'loading' | 'error' | 'success'; data: T | null };

type TargetsLoadable = Loadable<StreamTargets> & { errorCode?: string };

function ModalSurface(): ReactNode {
  const { t } = useI18n();
  const target = usePlayerStore((state) => state.target);
  const close = usePlayerStore((state) => state.close);
  const open = usePlayerStore((state) => state.open);
  const connectionId = useConnectionStore((state) => state.connectionId);

  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [targets, setTargets] = useState<TargetsLoadable>({ status: 'loading', data: null });
  const [movie, setMovie] = useState<Loadable<VodDetail>>({ status: 'idle', data: null });
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    return () => {
      if (copiedTimerRef.current !== null) clearTimeout(copiedTimerRef.current);
    };
  }, []);

  // Resolve playback targets for the current item.
  useEffect(() => {
    if (target === null || connectionId === null) return;
    let stale = false;
    void queueMicrotask(() => {
      if (!stale) setTargets({ status: 'loading', data: null });
    });
    getPlayable(connectionId, target.catalogType, target.id)
      .then((data) => {
        if (!stale) setTargets({ status: 'success', data });
      })
      .catch((error: unknown) => {
        if (stale) return;
        setTargets({
          status: 'error',
          data: null,
          errorCode: error instanceof ApiError ? error.code : undefined,
        });
      });
    return () => {
      stale = true;
    };
  }, [target, connectionId]);

  // Movie metadata (lazy, only while a movie is open).
  useEffect(() => {
    if (target === null || connectionId === null || target.kind !== 'movie') {
      void queueMicrotask(() => setMovie({ status: 'idle', data: null }));
      return;
    }
    let stale = false;
    void queueMicrotask(() => {
      if (!stale) setMovie({ status: 'loading', data: null });
    });
    getVodDetail(connectionId, target.id)
      .then((data) => {
        if (!stale) setMovie({ status: 'success', data });
      })
      .catch(() => {
        if (!stale) setMovie({ status: 'error', data: null }); // metadata is optional
      });
    return () => {
      stale = true;
    };
  }, [target, connectionId]);

  if (target === null) return null;

  function goNextEpisode(): void {
    const context = target?.seriesContext;
    if (target === undefined || target === null || context === undefined) return;
    const next = context.index + 1;
    const episode = context.episodes[next];
    if (episode === undefined) return;
    open({
      ...target,
      id: episode.id,
      name: episode.title,
      seriesContext: { ...context, index: next },
    });
  }

  async function handleCopyLink(): Promise<void> {
    if (targets.data === null) return;
    const ok = await copyTextToClipboard(targets.data.copyUrl);
    if (ok) {
      setCopied(true);
      if (copiedTimerRef.current !== null) clearTimeout(copiedTimerRef.current);
      copiedTimerRef.current = setTimeout(() => setCopied(false), 1_500);
    }
  }

  const seriesContext = target.seriesContext;
  const hasNext =
    seriesContext !== undefined && seriesContext.index < seriesContext.episodes.length - 1;

  const kindBadge =
    target.kind === 'channel' ? t.nav.tv : target.kind === 'movie' ? t.nav.movies : t.nav.series;

  const downloadName = `${target.name.replace(/[^\w .-]+/g, '').trim() || 'video'}.${targets.data?.extension ?? 'mp4'}`;

  return (
    <ModalShell onClose={close} ariaLabel={target.name} maxWidthClass="max-w-4xl">
      {targets.status === 'error' ? (
        <div className="flex aspect-video flex-col items-center justify-center gap-3 bg-black px-6 text-center">
          <AlertTriangle className="h-7 w-7 text-red-400" aria-hidden />
          <p className="text-[13px] text-white/70">{t.playback.loadFailed}</p>
        </div>
      ) : targets.data === null ? (
        <div className="flex aspect-video flex-col items-center justify-center gap-3 bg-black">
          <Loader2 className="h-6 w-6 animate-spin text-white/50" aria-hidden />
          <p className="text-xs text-white/50">{t.playback.loading}</p>
        </div>
      ) : (
        <VideoStage
          key={`${target.kind}-${target.id}`}
          src={targets.data.proxyUrl}
          extension={targets.data.extension}
          isLive={targets.data.kind === 'live'}
        />
      )}

      <div className="space-y-4 p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-[11px] font-medium text-white/46">
              <span className="rounded bg-white/10 px-1.5 py-0.5">{kindBadge}</span>
              {targets.data !== null && (
                <span className="rounded bg-white/10 px-1.5 py-0.5 tracking-wide">
                  {targets.data.extension}
                </span>
              )}
            </div>
            <h2
              title={target.name}
              className="mt-1 cursor-pointer truncate text-[15px] font-semibold tracking-tight text-white"
            >
              {target.name}
            </h2>
          </div>

          <button
            type="button"
            onClick={close}
            aria-label={t.playback.close}
            className="shrink-0 rounded-[10px] border border-line bg-surface p-2 text-white/60 transition hover:bg-hover hover:text-white"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>

        {target.kind === 'movie' &&
          (movie.status === 'loading' ? (
            <div className="flex animate-pulse gap-4">
              <div className="h-3 w-3/4 rounded bg-white/10" />
            </div>
          ) : movie.status === 'success' && movie.data !== null ? (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-white/46">
                {movie.data.releaseDate !== null && <span>{movie.data.releaseDate}</span>}
                {movie.data.duration !== null && <span>{movie.data.duration}</span>}
                {movie.data.genre !== null && <span>{movie.data.genre}</span>}
                {movie.data.rating !== null && (
                  <span className="text-white">★ {movie.data.rating}</span>
                )}
              </div>
              {movie.data.plot !== null && (
                <p className="max-w-3xl text-[13px] leading-relaxed text-white/60">
                  {movie.data.plot}
                </p>
              )}
              {movie.data.cast !== null && (
                <p className="text-xs text-white/46">
                  <span className="font-medium text-white/70">{t.playback.cast}: </span>
                  {movie.data.cast}
                </p>
              )}
            </div>
          ) : null)}

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void handleCopyLink()}
            disabled={targets.data === null}
            className="inline-flex items-center gap-2 rounded-[10px] border border-line bg-surface px-3 py-1.5 text-xs font-medium text-white transition hover:bg-hover disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Copy className="h-3.5 w-3.5" aria-hidden />
            {copied ? t.playback.copied : t.playback.copyLink}
          </button>

          {target.kind === 'movie' && targets.data !== null && (
            <a
              href={`${targets.data.proxyUrl}?dl=1&name=${encodeURIComponent(downloadName)}`}
              download={downloadName}
              className="inline-flex items-center gap-2 rounded-[10px] border border-line bg-surface px-3 py-1.5 text-xs font-medium text-white transition hover:bg-hover"
            >
              <Download className="h-3.5 w-3.5" aria-hidden />
              {t.playback.download}
            </a>
          )}

          {hasNext && (
            <button
              type="button"
              onClick={goNextEpisode}
              className="ml-auto inline-flex items-center gap-2 rounded-[10px] bg-white px-3 py-1.5 text-xs font-semibold text-app transition hover:bg-white/90"
            >
              {t.playback.nextEpisode}
              <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            </button>
          )}
        </div>
      </div>
    </ModalShell>
  );
}

export function PlayerModal() {
  const hasTarget = usePlayerStore((state) => state.target !== null);
  if (!hasTarget) return null;
  return <ModalSurface />;
}
