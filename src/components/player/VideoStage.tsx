import { useRef } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { useI18n } from '../../i18n/useI18n';
import { usePlayback, type PlaybackErrorCode } from './usePlayback';

interface VideoStageProps {
  src: string | null;
  extension: string | null;
  isLive: boolean;
}

const ERROR_MESSAGE_KEY: Record<
  PlaybackErrorCode,
  'unavailable' | 'networkError' | 'unsupportedFormat' | 'generic'
> = {
  unavailable: 'unavailable',
  network: 'networkError',
  unsupported: 'unsupportedFormat',
  unknown: 'generic',
};

export function VideoStage({ src, extension, isLive }: VideoStageProps) {
  const { t } = useI18n();
  const videoRef = useRef<HTMLVideoElement>(null);

  const { phase, errorCode, retriesLeft, retry, audioTracks, activeAudioTrack, selectAudioTrack } =
    usePlayback({ videoRef, src, extension });

  const showError = phase === 'error';

  return (
    <div className="relative aspect-video w-full overflow-hidden bg-black">
      <video ref={videoRef} controls playsInline autoPlay className="h-full w-full" />

      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-2 bg-gradient-to-b from-black/70 to-transparent p-2.5">
        <div className="flex min-w-0 items-center gap-2">
          {isLive && (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-red-600 px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-white">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" aria-hidden />
              {t.playback.live}
            </span>
          )}
          {phase === 'loading' && (
            <span className="inline-flex items-center rounded-full bg-black/60 px-2 py-0.5 text-[11px] text-white/70 backdrop-blur">
              {t.playback.loading}
            </span>
          )}
        </div>

        {audioTracks.length > 1 && activeAudioTrack !== null && (
          <select
            aria-label={t.playback.audio}
            value={activeAudioTrack}
            onChange={(event) => selectAudioTrack(Number(event.target.value))}
            className="pointer-events-auto max-w-[10rem] rounded-md border border-white/15 bg-black/60 px-2 py-1 text-xs text-white outline-none backdrop-blur"
          >
            {audioTracks.map((track) => (
              <option key={track.id} value={track.id}>
                {track.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {showError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/85 px-6 text-center">
          <AlertTriangle className="h-7 w-7 text-red-400" aria-hidden />
          <p className="max-w-md text-[13px] leading-relaxed text-white/80">
            {t.playback[ERROR_MESSAGE_KEY[errorCode ?? 'unknown']]}
            {errorCode !== 'unsupported' && retriesLeft === 0 && (
              <span className="block text-xs text-white/46">{t.playback.retriesExhausted}</span>
            )}
          </p>
          <button
            type="button"
            onClick={retry}
            className="inline-flex items-center gap-2 rounded-[10px] bg-white px-4 py-2 text-[13px] font-semibold text-app transition hover:bg-white/90"
          >
            <RotateCcw className="h-4 w-4" aria-hidden />
            {t.catalog.retry}
          </button>
        </div>
      )}
    </div>
  );
}
