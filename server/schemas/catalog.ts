import { z } from 'zod';

export const catalogTypeSchema = z.enum(['tv', 'movies', 'series']);
export type CatalogType = z.infer<typeof catalogTypeSchema>;

const CATALOG_ACTIONS = {
  tv: { categories: 'get_live_categories', streams: 'get_live_streams' },
  movies: { categories: 'get_vod_categories', streams: 'get_vod_streams' },
  series: { categories: 'get_series_categories', streams: 'get_series' },
} as const;

export function catalogActionsFor(type: CatalogType): { categories: string; streams: string } {
  return CATALOG_ACTIONS[type];
}

/* ------------------------------------------------------------------ */
/* Normalized models returned by our API                               */
/* ------------------------------------------------------------------ */

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

/** Response envelopes */
export interface CatalogResponse<TItem> {
  items: TItem[];
}

export type CatalogStreamsResponse =
  | CatalogResponse<Channel>
  | CatalogResponse<Movie>
  | CatalogResponse<SeriesSummary>;
