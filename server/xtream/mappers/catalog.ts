import { invalidResponseError } from '../errors';
import {
  asFiniteNumber,
  asHttpUrlOrNull,
  asIdentifier,
  asOptionalTrimmedString,
  asRecordArray,
  isRecord,
} from '../../utils/coerce';
import type {
  Category,
  Channel,
  Episode,
  Movie,
  Season,
  SeriesDetail,
  SeriesSummary,
  VodDetail,
} from '../../schemas/catalog';

/** get_live_categories / get_vod_categories / get_series_categories */
export function mapCategories(payload: unknown): Category[] {
  return asRecordArray(payload)
    .map((raw): Category | null => {
      const id = asIdentifier(raw.category_id);
      if (id === null) return null;
      return {
        id,
        name: asOptionalTrimmedString(raw.category_name) ?? '',
        parentId: asIdentifier(raw.parent_id),
      };
    })
    .filter((category): category is Category => category !== null);
}

/** get_live_streams */
export function mapLiveStreams(payload: unknown): Channel[] {
  return asRecordArray(payload)
    .map((raw): Channel | null => {
      const id = asIdentifier(raw.stream_id) ?? asIdentifier(raw.num);
      if (id === null) return null;
      return {
        id,
        name: asOptionalTrimmedString(raw.name) ?? '',
        logo: asHttpUrlOrNull(raw.stream_icon),
        categoryId: asIdentifier(raw.category_id) ?? '',
        epgId: asOptionalTrimmedString(raw.epg_channel_id),
        number: asFiniteNumber(raw.num),
      };
    })
    .filter((channel): channel is Channel => channel !== null);
}

/** get_vod_streams */
export function mapVodStreams(payload: unknown): Movie[] {
  return asRecordArray(payload)
    .map((raw): Movie | null => {
      const id = asIdentifier(raw.stream_id);
      if (id === null) return null;
      return {
        id,
        name: asOptionalTrimmedString(raw.name) ?? '',
        logo: asHttpUrlOrNull(raw.stream_icon),
        categoryId: asIdentifier(raw.category_id) ?? '',
        extension: asOptionalTrimmedString(raw.container_extension),
        rating: asOptionalTrimmedString(raw.rating),
      };
    })
    .filter((movie): movie is Movie => movie !== null);
}

/** get_series (list) */
export function mapSeriesList(payload: unknown): SeriesSummary[] {
  return asRecordArray(payload)
    .map((raw): SeriesSummary | null => {
      const id = asIdentifier(raw.series_id);
      if (id === null) return null;
      return {
        id,
        name: asOptionalTrimmedString(raw.name) ?? '',
        cover: asHttpUrlOrNull(raw.cover),
        categoryId: asIdentifier(raw.category_id) ?? '',
        plot: asOptionalTrimmedString(raw.plot),
        genre: asOptionalTrimmedString(raw.genre),
        rating: asOptionalTrimmedString(raw.rating),
      };
    })
    .filter((series): series is SeriesSummary => series !== null);
}

function mapSeasons(payload: Record<string, unknown>): Season[] {
  const seasons = asRecordArray(payload.seasons)
    .map((raw): Season | null => {
      const number = asFiniteNumber(raw.season_number) ?? asFiniteNumber(raw.season);
      if (number === null) return null;
      return {
        number,
        name: asOptionalTrimmedString(raw.name),
        episodeCount: asFiniteNumber(raw.episode_count),
        cover: asHttpUrlOrNull(raw.cover),
      };
    })
    .filter((season): season is Season => season !== null);

  // Deduplicate by season number keeping the first occurrence.
  const seen = new Set<number>();
  return seasons.filter((season) => {
    if (seen.has(season.number)) return false;
    seen.add(season.number);
    return true;
  });
}

function mapEpisodes(payload: Record<string, unknown>): Episode[] {
  const rawEpisodes = payload.episodes;
  if (!isRecord(rawEpisodes)) return [];

  const episodes: Episode[] = [];
  for (const [seasonKey, seasonValue] of Object.entries(rawEpisodes)) {
    const parsedSeason = Number.parseInt(seasonKey, 10);
    const fallbackSeason = Number.isInteger(parsedSeason) ? parsedSeason : 0;

    for (const raw of asRecordArray(seasonValue)) {
      const id = asIdentifier(raw.id);
      if (id === null) continue;
      episodes.push({
        id,
        title: asOptionalTrimmedString(raw.title) ?? '',
        seasonNumber: asFiniteNumber(raw.season) ?? fallbackSeason,
        episodeNumber: asFiniteNumber(raw.episode_num),
        extension: asOptionalTrimmedString(raw.container_extension),
        image: asHttpUrlOrNull(isRecord(raw.info) ? raw.info.movie_image : undefined),
      });
    }
  }
  return episodes;
}

/**
 * get_series_info → normalized detail. Throws INVALID_RESPONSE when the
 * payload has neither `info` nor `episodes` (some panels answer with
 * `{}` or an HTML error page).
 */
export function mapSeriesInfo(seriesId: string, payload: unknown): SeriesDetail {
  if (!isRecord(payload)) {
    throw invalidResponseError('The series response has an unexpected shape.');
  }

  const hasUsableContent = isRecord(payload.episodes) || isRecord(payload.info);
  if (!hasUsableContent) {
    throw invalidResponseError('The series response has no usable content.');
  }

  const info = isRecord(payload.info) ? payload.info : {};
  const seasons = mapSeasons(payload);
  const episodes = mapEpisodes(payload);

  // Include seasons that only exist as episode keys (common on some servers).
  const knownSeasons = new Set(seasons.map((season) => season.number));
  for (const episode of episodes) {
    if (!knownSeasons.has(episode.seasonNumber)) {
      knownSeasons.add(episode.seasonNumber);
      seasons.push({
        number: episode.seasonNumber,
        name: null,
        episodeCount: null,
        cover: null,
      });
    }
  }
  seasons.sort((a, b) => a.number - b.number);

  return {
    id: seriesId,
    name: asOptionalTrimmedString(info.name) ?? '',
    cover: asHttpUrlOrNull(info.cover),
    plot: asOptionalTrimmedString(info.plot),
    genre: asOptionalTrimmedString(info.genre),
    rating: asOptionalTrimmedString(info.rating),
    releaseDate: asOptionalTrimmedString(info.releaseDate),
    seasons,
    episodes,
  };
}

/** get_vod_info → normalized movie detail (tolerant of missing fields). */
export function mapVodInfo(vodId: string, payload: unknown): VodDetail {
  if (!isRecord(payload)) {
    throw invalidResponseError('The movie response has an unexpected shape.');
  }

  const info = isRecord(payload.info) ? payload.info : {};
  const data = isRecord(payload.movie_data) ? payload.movie_data : {};

  const id = asIdentifier(data.stream_id) ?? vodId;

  return {
    id,
    name: asOptionalTrimmedString(data.name) ?? '',
    coverBig: asHttpUrlOrNull(info.movie_img) ?? asHttpUrlOrNull(info.cover_big),
    plot: asOptionalTrimmedString(info.plot),
    cast: asOptionalTrimmedString(info.cast),
    director: asOptionalTrimmedString(info.director),
    genre: asOptionalTrimmedString(info.genre),
    releaseDate: asOptionalTrimmedString(info.releaseDate) ?? asOptionalTrimmedString(info.releasedate),
    duration: asOptionalTrimmedString(info.duration),
    rating: asOptionalTrimmedString(info.rating),
    youtubeTrailer: asHttpUrlOrNull(info.youtube_trailer),
    extension: asOptionalTrimmedString(data.container_extension),
    categoryId: asIdentifier(data.category_id) ?? '',
  };
}
