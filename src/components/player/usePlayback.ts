import { useEffect, useRef, useState, type RefObject } from 'react';
import type HlsDefault from 'hls.js';
import type { ErrorData, HlsConfig } from 'hls.js';
import type MpegtsDefault from 'mpegts.js';

export type PlaybackErrorCode = 'unavailable' | 'network' | 'unsupported' | 'unknown';
export type PlaybackEngine = 'hls' | 'mpegts' | 'native';

export interface PlaybackState {
  phase: 'loading' | 'playing' | 'error';
  errorCode?: PlaybackErrorCode;
  retriesLeft: number;
}

export interface AudioTrackOption {
  id: number;
  name: string;
}

const MAX_AUTO_RETRIES = 3;
const BACKOFF_MS = [1_000, 2_000, 4_000];

/** Numeric codes kept local: HTMLMediaElement errors lack a typed enum here. */
const MEDIA_ERROR = {
  DECODE: 3,
  SRC_NOT_SUPPORTED: 4,
} as const;

/** Pure engine selection — trivially unit-testable. */
export function selectEngine(extension: string | null): PlaybackEngine {
  const ext = (extension ?? '').toLowerCase();
  if (ext === 'm3u8' || ext === 'm3u') return 'hls';
  if (ext === 'ts') return 'mpegts';
  return 'native';
}

function classifyHlsError(data: ErrorData): PlaybackErrorCode {
  const status = data.response?.code ?? 0;
  if (status === 403 || status === 404 || status === 410) return 'unavailable';
  if (data.details.includes('manifest') || data.details.includes('network')) return 'network';
  return 'unknown';
}

interface UsePlaybackOptions {
  videoRef: RefObject<HTMLVideoElement | null>;
  src: string | null;
  extension: string | null;
}

export interface PlaybackApi extends PlaybackState {
  retry: () => void;
  audioTracks: AudioTrackOption[];
  activeAudioTrack: number | null;
  selectAudioTrack: (id: number) => void;
}

/**
 * Owns one playback engine per <video>: dynamic imports on first use,
 * fatal-error classification, automatic retries with backoff, multi-language
 * audio tracks, and full teardown so buffers/workers are released on close.
 *
 * Engines: hls.js for manifests, mpegts.js for raw live TS, native otherwise.
 */
export function usePlayback({ videoRef, src, extension }: UsePlaybackOptions): PlaybackApi {
  const [state, setState] = useState<PlaybackState>({
    phase: 'loading',
    retriesLeft: MAX_AUTO_RETRIES,
  });
  const [audioTracks, setAudioTracks] = useState<AudioTrackOption[]>([]);
  const [activeAudioTrack, setActiveAudioTrack] = useState<number | null>(null);
  const [attemptToken, setAttemptToken] = useState(0);

  const hlsRef = useRef<HlsDefault | null>(null);
  const mpegtsRef = useRef<MpegtsDefault.Player | null>(null);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function clearPendingRetry(): void {
    if (retryTimerRef.current !== null) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
  }

  const retry = (): void => {
    clearPendingRetry();
    setState({ phase: 'loading', retriesLeft: MAX_AUTO_RETRIES });
    setAttemptToken((n) => n + 1);
  };

  useEffect(() => {
    const element = videoRef.current;
    if (src === null || element === null) return;

    // Non-null from here on (helps closures inside async attach()).
    const video: HTMLVideoElement = element;
    const engine = selectEngine(extension);
    let disposed = false;
    let autoRetriesUsed = 0;

    // Kick off asynchronously so the effect body itself never sets state.
    void queueMicrotask(() => {
      if (!disposed) {
        setState({ phase: 'loading', errorCode: undefined, retriesLeft: MAX_AUTO_RETRIES });
      }
    });

    const handleFatal = (code: PlaybackErrorCode): void => {
      if (disposed) return;
      if (autoRetriesUsed < MAX_AUTO_RETRIES && code !== 'unsupported') {
        const delay = BACKOFF_MS[Math.min(autoRetriesUsed, BACKOFF_MS.length - 1)];
        autoRetriesUsed += 1;
        setState({
          phase: 'loading',
          errorCode: code,
          retriesLeft: MAX_AUTO_RETRIES - autoRetriesUsed,
        });
        retryTimerRef.current = setTimeout(() => setAttemptToken((n) => n + 1), delay);
      } else {
        clearPendingRetry();
        setState({ phase: 'error', errorCode: code, retriesLeft: 0 });
      }
    };

    const markPlaying = (): void => {
      if (disposed) return;
      clearPendingRetry();
      setState({ phase: 'playing', errorCode: undefined, retriesLeft: MAX_AUTO_RETRIES });
    };
    video.addEventListener('playing', markPlaying);

    /** Direct files (mp4/mkv/webm…) play through the browser's own pipeline. */
    const attachNative = (): void => {
      const onError = (): void => {
        const mediaError = video.error?.code;
        handleFatal(
          mediaError === MEDIA_ERROR.SRC_NOT_SUPPORTED || mediaError === MEDIA_ERROR.DECODE
            ? 'unsupported'
            : 'network',
        );
      };
      video.addEventListener('error', onError);
      video.src = src as string;
      void video.play().catch(() => undefined); // autoplay rejection is non-fatal
    };

    /** Raw MPEG-TS live streams: browsers can't demux them; mpegts.js does. */
    const attachMpegts = async (): Promise<void> => {
      const mod = await import('mpegts.js');
      if (disposed) return;
      const mpegts = mod.default;
      if (!mpegts.getFeatureList().mseLivePlayback) {
        handleFatal('unsupported');
        return;
      }
      const player = mpegts.createPlayer(
        { type: 'mpegts', isLive: true, url: src as string },
        { enableWorker: true, liveBufferLatencyChasing: true },
      );
      mpegtsRef.current = player;
      player.attachMediaElement(video);
      player.load();
      void video.play().catch(() => undefined);
    };

    /** HLS manifests via hls.js (Safari falls back to its native HLS). */
    const attachHls = async (): Promise<void> => {
      const mod = await import('hls.js');
      if (disposed) return;
      const Hls = mod.default;

      if (!Hls.isSupported()) {
        if (video.canPlayType('application/vnd.apple.mpegurl') !== '') {
          attachNative();
        } else {
          handleFatal('unsupported');
        }
        return;
      }

      const config: Partial<HlsConfig> = {
        enableWorker: true,
        lowLatencyMode: false,
        backBufferLength: 30,
        maxBufferLength: 30,
      };
      const hls = new Hls(config);
      hlsRef.current = hls;

      const syncAudioTracks = (): void => {
        if (disposed) return;
        setAudioTracks(
          hls.audioTracks.map((track, index) => ({
            id: index,
            name: track.name !== '' ? track.name : (track.lang ?? `Audio ${index + 1}`),
          })),
        );
        setActiveAudioTrack(hls.audioTrack);
      };
      hls.on(Hls.Events.AUDIO_TRACKS_UPDATED, syncAudioTracks);
      hls.on(Hls.Events.AUDIO_TRACK_SWITCHED, (_event, data) => setActiveAudioTrack(data.id));

      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (disposed || !data.fatal) return;
        handleFatal(classifyHlsError(data));
      });

      hls.attachMedia(video);
      hls.loadSource(src as string);
    };

    if (engine === 'hls') {
      void attachHls();
    } else if (engine === 'mpegts') {
      void attachMpegts();
    } else {
      attachNative();
    }

    return () => {
      disposed = true;
      clearPendingRetry();
      video.removeEventListener('playing', markPlaying);
      hlsRef.current?.destroy();
      hlsRef.current = null;
      mpegtsRef.current?.destroy();
      mpegtsRef.current = null;
      video.pause();
      video.removeAttribute('src');
      video.load();
      setAudioTracks([]);
      setActiveAudioTrack(null);
    };
  }, [videoRef, src, extension, attemptToken]);

  function selectAudioTrack(id: number): void {
    if (hlsRef.current !== null) {
      hlsRef.current.audioTrack = id;
    }
  }

  return { ...state, retry, audioTracks, activeAudioTrack, selectAudioTrack };
}
