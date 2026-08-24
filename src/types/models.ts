export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export type StreamFormat = 'ts' | 'm3u8';

export type ApiErrorCode =
  | 'INVALID_URL'
  | 'SSRF_BLOCKED'
  | 'AUTH_FAILED'
  | 'ACCOUNT_EXPIRED'
  | 'ACCOUNT_DISABLED'
  | 'TIMEOUT'
  | 'DNS_FAILURE'
  | 'CONNECTION_REFUSED'
  | 'CONNECTION_RESET'
  | 'TLS_ERROR'
  | 'INVALID_RESPONSE'
  | 'NETWORK_ERROR'
  | 'VALIDATION_ERROR'
  | 'SESSION_NOT_FOUND'
  | 'PLAYLIST_NOT_FOUND'
  | 'UNKNOWN';

/** Normalized account information shown in the account bar. */
export interface AccountInfo {
  status: string | null;
  createdAt: string | null;
  expiresAt: string | null;
  maxConnections: number | null;
  activeConnections: number | null;
}

export interface ConnectionCredentials {
  server: string;
  username: string;
  password: string;
  streamFormat: StreamFormat;
  /** Accept panels presenting invalid TLS certificates. */
  allowInsecureTls: boolean;
}

export interface ConnectResult {
  connectionId: string;
  account: AccountInfo;
  /** Present when the session was started from a saved playlist. */
  playlistId?: string;
}

/** Server-side saved playlist — the password field is never included. */
export interface SavedPlaylist {
  id: string;
  label: string;
  server: string;
  username: string;
  streamFormat: StreamFormat;
  allowInsecureTls: boolean;
  createdAt: string;
  lastUsedAt: string;
}

/* ------------------------------------------------------------------ */
/* Catalog models (normalized by the backend)                          */
/* ------------------------------------------------------------------ */

export type CatalogType = 'tv' | 'movies' | 'series';

export interface Category {
  id: string;
  name: string;
  parentId: string | null;
}

export interface Channel {
  id: string;
  name: string;
  logo: string | null;
  categoryId: string;
  epgId: string | null;
  number: number | null;
}

export interface Movie {
  id: string;
  name: string;
  logo: string | null;
  categoryId: string;
  extension: string | null;
  rating: string | null;
}

export interface SeriesSummary {
  id: string;
  name: string;
  cover: string | null;
  categoryId: string;
  plot: string | null;
  genre: string | null;
  rating: string | null;
}

export interface Season {
  number: number;
  name: string | null;
  episodeCount: number | null;
  cover: string | null;
}

export interface Episode {
  id: string;
  title: string;
  seasonNumber: number;
  episodeNumber: number | null;
  extension: string | null;
  image: string | null;
}

export interface SeriesDetail {
  id: string;
  name: string;
  cover: string | null;
  plot: string | null;
  genre: string | null;
  rating: string | null;
  releaseDate: string | null;
  seasons: Season[];
  episodes: Episode[];
}

export type CatalogItem = Channel | Movie | SeriesSummary;

/* ------------------------------------------------------------------ */
/* Playback                                                            */
/* ------------------------------------------------------------------ */

export interface StreamTargets {
  kind: 'live' | 'movie' | 'series';
  id: string;
  extension: string;
  directUrl: string;
  copyUrl: string;
  proxyUrl: string;
}

export interface VodDetail {
  id: string;
  name: string;
  coverBig: string | null;
  plot: string | null;
  cast: string | null;
  director: string | null;
  genre: string | null;
  releaseDate: string | null;
  duration: string | null;
  rating: string | null;
  youtubeTrailer: string | null;
  extension: string | null;
  categoryId: string;
}

/** Episode reference used to power "next episode" inside the player. */
export interface EpisodeRef {
  id: string;
  title: string;
}

export type PlayerKind = 'channel' | 'movie' | 'episode';

export interface PlayRequest {
  kind: PlayerKind;
  catalogType: CatalogType;
  id: string;
  name: string;
  /** Present for episodes: enables next/previous without leaving the modal. */
  seriesContext?: { episodes: EpisodeRef[]; index: number };
}
