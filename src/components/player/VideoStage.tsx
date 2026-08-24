import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, Loader2, Maximize2, Minimize2, RotateCcw } from 'lucide-react';
import { useI18n } from '../../i18n/useI18n';
import { copyTextToClipboard } from '../../lib/clipboard';
import { usePlayback, type PlaybackErrorCode } from './usePlayback';

interface VideoStageProps {
  src: string | null;
  extension: string | null;
  name: string;
  isLive: boolean;
  /** Direct (credential-bearing) URL offered when playback fails. */
  copyUrl: string | null;
}

const ERROR_MESSAGE_KEY: Record<PlaybackErrorCode, 'unavailable' | 'networkError' | 'unsupportedFormat' | 'generic'> = {
  unavailable: 'unavailable',
  network: 'networkError',
  unsupported: 'unsupportedFormat',
  unknown: 'generic',
};

export function VideoStage({ src, extension, name, isLive, copyUrl }: VideoStageProps) {
  const { t } = useI18n();
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const { phase, errorCode, retriesLeft, retry, audioTracks, activeAudioTrack, selectAudioTrack } =
    usePlayback({ videoRef, src, extension });

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [copied, setCopied] = useState(false);
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (copiedTimerRef.current !== null) clearTimeout(copiedTimerRef.current);
    },
    [],
  );

  useEffect(() => {
    const onChange = (): void => setIsFullscreen(document.fullscreenElement === containerRef.current);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (containerRef.current === null) return;
    if (document.fullscreenElement === containerRef.current) {
      void document.exitFullscreen();
    } else {
      void containerRef.current.requestFullscreen().catch(() => undefined);
    }
  }, []);

  async function handleCopy(): Promise<void> {
    if (copyUrl === null) return;
    const ok = await copyTextToClipboard(copyUrl);
    if (ok) {
      setCopied(true);
      if (copiedTimerRef.current !== null) clearTimeout(copiedTimerRef.current);
      copiedTimerRef.current = setTimeout(() => setCopied(false), 1_500);
    }
  }

  return (
    <div ref={containerRef} className="relative aspect-video w-full bg-black">
      <video ref={videoRef} controls playsInline autoPlay className="h-full w-full" />

      {/* Top gradient with title / live badge */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-3 bg-gradient-to-b from-black/80 to-transparent p-3">
        <div className="flex min-w-0 items-center gap-2">
          {isLive && (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-red-600 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" aria-hidden />
              {t.playback.live}
            </span>
          )}
          <p className="truncate text-sm font-semibold text-white drop-shadow">{name}</p>
        </div>

        <div className="pointer-events-auto flex shrink-0 items-center gap-2">
          {audioTracks.length > 1 && activeAudioTrack !== null && (
            <select
              aria-label={t.playback.audio}
              value={activeAudioTrack}
              onChange={(event) => selectAudioTrack(Number(event.target.value))}
              className="max-w-[10rem] rounded-md border border-white/20 bg-black/60 px-1.5 py-0.5 text-xs text-white outline-none"
            >
              {audioTracks.map((track) => (
                <option key={track.id} value={track.id}>
                  {t.playback.audio}: {track.name}
                </option>
              ))}
            </select>
          )}
          <button
            type="button"
            onClick={toggleFullscreen}
            aria-label={t.playback.fullscreen}
            className="rounded-md border border-white/20 bg-black/60 p-1.5 text-white transition hover:bg-black/80"
          >
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Loading / error overlays */}
      {phase === 'loading' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/70">
          <Loader2 className="h-9 w-9 animate-spin text-accent" aria-hidden />
          <p className="text-sm text-zinc-300">{t.playback.loading}</p>
        </div>
      )}

      {phase === 'error' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/85 px-6 text-center">
          <AlertTriangle className="h-9 w-9 text-red-400" aria-hidden />
          <p className="max-w-md text-sm leading-relaxed text-zinc-200">
            {t.playback[ERROR_MESSAGE_KEY[errorCode ?? 'unknown']]}
            {errorCode !== 'unsupported' && retriesLeft === 0 && (
              <span className="block text-xs text-zinc-500">{t.playback.retriesExhausted}</span>
            )}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={retry}
              className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:bg-accent/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              <RotateCcw className="h-4 w-4" aria-hidden />
              {t.catalog.retry}
            </button>
            {copyUrl !== null && (
              <button
                type="button"
                onClick={() => void handleCopy()}
                className="rounded-lg border border-line bg-surface-raised px-4 py-2 text-sm font-medium text-zinc-100 transition hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                {copied ? t.playback.copied : t.playback.copyLink}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
