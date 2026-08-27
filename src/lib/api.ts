import { z } from 'zod';
import type {
  ApiErrorCode,
  CatalogType,
  Category,
  Channel,
  ConnectResult,
  ConnectionCredentials,
  Movie,
  SavedPlaylist,
  SeriesDetail,
  SeriesSummary,
  StreamTargets,
  VodDetail,
} from '../types/models';
import { normalizeRating } from './rating';

const API_BASE: string = import.meta.env.VITE_API_URL ?? '/api';
const CONNECTION_ID_HEADER = 'x-connection-id';

const KNOWN_ERROR_CODES: readonly ApiErrorCode[] = [
  'INVALID_URL',
  'SSRF_BLOCKED',
  'AUTH_FAILED',
  'ACCOUNT_EXPIRED',
  'ACCOUNT_DISABLED',
  'TIMEOUT',
  'DNS_FAILURE',
  'CONNECTION_REFUSED',
  'CONNECTION_RESET',
  'TLS_ERROR',
  'INVALID_RESPONSE',
  'NETWORK_ERROR',
  'VALIDATION_ERROR',
  'SESSION_NOT_FOUND',
];

function toErrorCode(value: string): ApiErrorCode {
  const match = KNOWN_ERROR_CODES.find((code) => code === value);
  return match ?? 'UNKNOWN';
}

export class ApiError extends Error {
  readonly code: ApiErrorCode;

  constructor(code: ApiErrorCode, message: string) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
  }
}

const errorEnvelopeSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
  }),
});

const streamFormatSchema = z.enum(['ts', 'm3u8']);

const accountSchema = z.object({
  status: z.string().nullable(),
  createdAt: z.string().nullable(),
  expiresAt: z.string().nullable(),
  maxConnections: z.number().nullable(),
  activeConnections: z.number().nullable(),
});

const connectResponseSchema = z.object({
  connectionId: z.string().min(1),
  account: accountSchema,
  playlistId: z.string().min(1).optional(),
});

const savedPlaylistSchema = z.object({
  id: z.string(),
  label: z.string(),
  server: z.string(),
  username: z.string(),
  streamFormat: streamFormatSchema,
  allowInsecureTls: z.boolean(),
  createdAt: z.string(),
  lastUsedAt: z.string(),
});

async function requestJson<T>(path: string, init: RequestInit, signal?: AbortSignal): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, { ...init, signal });
  } catch {
    throw new ApiError('NETWORK_ERROR', 'The request to the local server failed.');
  }

  const text = await response.text();

  if (!response.ok) {
    let code: ApiErrorCode = 'UNKNOWN';
    try {
      const envelope = errorEnvelopeSchema.parse(JSON.parse(text));
      code = toErrorCode(envelope.error.code);
    } catch {
      // Keep UNKNOWN when the body is not the expected envelope.
    }
    throw new ApiError(code, `Request failed with HTTP ${response.status}.`);
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new ApiError('INVALID_RESPONSE', 'The local server returned an invalid payload.');
  }
}

function headersWithConnectionId(connectionId?: string): HeadersInit {
  return connectionId === undefined ? {} : { [CONNECTION_ID_HEADER]: connectionId };
}

export async function postConnection(credentials: ConnectionCredentials): Promise<ConnectResult> {
  const raw = await requestJson<unknown>('/connection', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(credentials),
  });
  return connectResponseSchema.parse(raw);
}

export async function getAccount(
  connectionId: string,
): Promise<{ account: ConnectResult['account'] }> {
  const raw = await requestJson<unknown>('/account', {
    method: 'GET',
    headers: headersWithConnectionId(connectionId),
  });
  const schema = z.object({ account: accountSchema });
  return schema.parse(raw);
}

export async function getPlaylists(): Promise<SavedPlaylist[]> {
  const raw = await requestJson<unknown>('/playlists', { method: 'GET' });
  return z.object({ items: z.array(savedPlaylistSchema) }).parse(raw).items;
}

export async function connectPlaylist(playlistId: string): Promise<ConnectResult> {
  const raw = await requestJson<unknown>('/playlists/connect', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ playlistId }),
  });
  return connectResponseSchema.parse(raw);
}

export async function deletePlaylist(playlistId: string): Promise<void> {
  await requestJson<{ ok: boolean }>(`/playlists/${encodeURIComponent(playlistId)}`, {
    method: 'DELETE',
  });
}

export async function deleteConnection(connectionId: string): Promise<void> {
  await requestJson<{ ok: boolean }>('/connection', {
    method: 'DELETE',
    headers: headersWithConnectionId(connectionId),
  });
}

/* ------------------------------------------------------------------ */
/* Catalog endpoints                                                   */
/* ------------------------------------------------------------------ */

const categorySchema = z.object({
  id: z.string(),
  name: z.string(),
  parentId: z.string().nullable(),
});

const channelSchema = z.object({
  id: z.string(),
  name: z.string(),
  logo: z.string().nullable(),
  categoryId: z.string(),
  epgId: z.string().nullable(),
  number: z.number().nullable(),
});

const movieSchema = z.object({
  id: z.string(),
  name: z.string(),
  logo: z.string().nullable(),
  categoryId: z.string(),
  extension: z.string().nullable(),
  rating: z
    .string()
    .nullable()
    .transform((value) => normalizeRating(value)),
});

const seriesSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  cover: z.string().nullable(),
  categoryId: z.string(),
  plot: z.string().nullable(),
  genre: z.string().nullable(),
  rating: z
    .string()
    .nullable()
    .transform((value) => normalizeRating(value)),
});

const seasonSchema = z.object({
  number: z.number(),
  name: z.string().nullable(),
  episodeCount: z.number().nullable(),
  cover: z.string().nullable(),
});

const episodeSchema = z.object({
  id: z.string(),
  title: z.string(),
  seasonNumber: z.number(),
  episodeNumber: z.number().nullable(),
  extension: z.string().nullable(),
  image: z.string().nullable(),
});

const seriesDetailSchema = z.object({
  id: z.string(),
  name: z.string(),
  cover: z.string().nullable(),
  plot: z.string().nullable(),
  genre: z.string().nullable(),
  rating: z
    .string()
    .nullable()
    .transform((value) => normalizeRating(value)),
  releaseDate: z.string().nullable(),
  seasons: z.array(seasonSchema),
  episodes: z.array(episodeSchema),
});

function catalogHeaders(connectionId: string): HeadersInit {
  return { ...headersWithConnectionId(connectionId) };
}

export async function getCategories(
  connectionId: string,
  type: CatalogType,
  signal?: AbortSignal,
): Promise<Category[]> {
  const raw = await requestJson<unknown>(
    `/categories/${type}`,
    {
      method: 'GET',
      headers: catalogHeaders(connectionId),
    },
    signal,
  );
  const parsed = z.object({ items: z.array(categorySchema) }).parse(raw);
  return parsed.items;
}

export async function getStreams(
  connectionId: string,
  type: CatalogType,
  categoryId: string,
  signal?: AbortSignal,
): Promise<Channel[] | Movie[] | SeriesSummary[]> {
  const raw = await requestJson<unknown>(
    `/streams/${type}/${encodeURIComponent(categoryId)}`,
    {
      method: 'GET',
      headers: catalogHeaders(connectionId),
    },
    signal,
  );
  if (type === 'tv') {
    return z.object({ items: z.array(channelSchema) }).parse(raw).items;
  }
  if (type === 'movies') {
    return z.object({ items: z.array(movieSchema) }).parse(raw).items;
  }
  return z.object({ items: z.array(seriesSummarySchema) }).parse(raw).items;
}

/** Full catalog for a type — powers the content search. */
export async function getAllStreams(
  connectionId: string,
  type: CatalogType,
  signal?: AbortSignal,
): Promise<Channel[] | Movie[] | SeriesSummary[]> {
  const raw = await requestJson<unknown>(
    `/streams/${type}`,
    {
      method: 'GET',
      headers: catalogHeaders(connectionId),
    },
    signal,
  );
  if (type === 'tv') {
    return z.object({ items: z.array(channelSchema) }).parse(raw).items;
  }
  if (type === 'movies') {
    return z.object({ items: z.array(movieSchema) }).parse(raw).items;
  }
  return z.object({ items: z.array(seriesSummarySchema) }).parse(raw).items;
}

export async function getSeriesDetail(
  connectionId: string,
  seriesId: string,
  signal?: AbortSignal,
): Promise<SeriesDetail> {
  const raw = await requestJson<unknown>(
    `/series/${encodeURIComponent(seriesId)}`,
    {
      method: 'GET',
      headers: catalogHeaders(connectionId),
    },
    signal,
  );
  return z.object({ series: seriesDetailSchema }).parse(raw).series;
}

/* ------------------------------------------------------------------ */
/* Playback endpoints                                                  */
/* ------------------------------------------------------------------ */

const streamTargetsSchema = z.object({
  kind: z.enum(['live', 'movie', 'series']),
  id: z.string(),
  extension: z.string(),
  directUrl: z.string(),
  copyUrl: z.string(),
  proxyUrl: z.string(),
});

const vodDetailSchema = z.object({
  id: z.string(),
  name: z.string(),
  coverBig: z.string().nullable(),
  plot: z.string().nullable(),
  cast: z.string().nullable(),
  director: z.string().nullable(),
  genre: z.string().nullable(),
  releaseDate: z.string().nullable(),
  duration: z.string().nullable(),
  rating: z
    .string()
    .nullable()
    .transform((value) => normalizeRating(value)),
  youtubeTrailer: z.string().nullable(),
  extension: z.string().nullable(),
  categoryId: z.string(),
});

export async function getPlayable(
  connectionId: string,
  type: CatalogType,
  id: string,
): Promise<StreamTargets> {
  const raw = await requestJson<unknown>(`/playable/${type}/${encodeURIComponent(id)}`, {
    method: 'GET',
    headers: headersWithConnectionId(connectionId),
  });
  return streamTargetsSchema.parse(raw);
}

export async function getVodDetail(connectionId: string, movieId: string): Promise<VodDetail> {
  const raw = await requestJson<unknown>(`/vod/${encodeURIComponent(movieId)}`, {
    method: 'GET',
    headers: headersWithConnectionId(connectionId),
  });
  return z.object({ movie: vodDetailSchema }).parse(raw).movie;
}

/* ------------------------------------------------------------------ */
/* Playlist export (blob download with native progress)                */
/* ------------------------------------------------------------------ */

const FALLBACK_EXPORT_NAMES: Record<CatalogType, string> = {
  tv: 'iptv-live.m3u8',
  movies: 'iptv-movies.m3u8',
  series: 'iptv-series.json',
};

/** User-Agent pipe options for M3U exports (series JSON ignores them). */
export type UaMode = 'default' | 'none' | 'custom';

export interface ExportOptions {
  uaMode: UaMode;
  /** Required when uaMode is 'custom'. */
  ua?: string;
}

export async function getAppConfig(): Promise<{ defaultUserAgent: string }> {
  const raw = await requestJson<unknown>('/app-config', { method: 'GET' });
  return z.object({ defaultUserAgent: z.string() }).parse(raw);
}

/**
 * Downloads the per-tab playlist export. Uses fetch+blob so envelope errors
 * are catchable and a spinner state is possible; the object URL is revoked
 * right after the browser picks the file up.
 */
export async function downloadPlaylist(
  connectionId: string,
  type: CatalogType,
  options?: ExportOptions,
): Promise<void> {
  const params = new URLSearchParams();
  if (options !== undefined) {
    params.set('uaMode', options.uaMode);
    if (options.ua !== undefined && options.ua.length > 0) {
      params.set('ua', options.ua);
    }
  }
  const query = params.size > 0 ? `?${params.toString()}` : '';

  const response = await fetch(`${API_BASE}/playlist/${type}${query}`, {
    headers: { [CONNECTION_ID_HEADER]: connectionId },
  });

  if (!response.ok) {
    const text = await response.text();
    let code: ApiErrorCode = 'UNKNOWN';
    try {
      code = toErrorCode(errorEnvelopeSchema.parse(JSON.parse(text)).error.code);
    } catch {
      // Keep UNKNOWN when the body is not the expected envelope.
    }
    throw new ApiError(code, `Download failed with HTTP ${response.status}.`);
  }

  const blob = await response.blob();
  const disposition = response.headers.get('content-disposition') ?? '';
  const filename = /filename="([^"]+)"/.exec(disposition)?.[1] ?? FALLBACK_EXPORT_NAMES[type];

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1_000);
}
