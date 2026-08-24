import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { generateM3uPlaylist, type M3uItem } from '../services/m3u';
import { XTREAM_USER_AGENT } from '../xtream/client';
import { buildDirectStreamUrl } from '../xtream/streams';
import type { CatalogType } from '../schemas/catalog';
import { validationError } from '../xtream/errors';
import { bindAbortToRequest, parseCatalogType, requireSession } from './session';
import { getCategoriesCached, getStreamsCached } from './catalog';
import type { Channel, Movie, SeriesSummary } from '../schemas/catalog';
import type { StoredSession } from '../services/session-store';
import { RequestAbortedError } from '../xtream/errors';

const FILENAMES: Record<CatalogType, string> = {
  tv: 'iptv-live.m3u8',
  movies: 'iptv-movies.m3u8',
  series: 'iptv-series.json',
};

function dedupeById<T extends { id: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

// Fetch streams category by category to keep each upstream response under the size cap.
async function collectStreamsForExport(
  session: StoredSession,
  type: CatalogType,
  categories: { id: string }[],
  signal?: AbortSignal,
): Promise<unknown[]> {
  if (categories.length === 0) {
    return (await getStreamsCached(session, type, null, signal)) as unknown[];
  }

  const settled = await Promise.allSettled(
    categories.map((category) => getStreamsCached(session, type, category.id, signal)),
  );

  const aggregated: unknown[] = [];
  for (const result of settled) {
    if (result.status === 'fulfilled') aggregated.push(...(result.value as unknown[]));
  }

  if (aggregated.length > 0) return aggregated;
  if (signal?.aborted) throw new RequestAbortedError();

  // All per-category requests failed: fallback to full catalog so the original error surfaces.
  return (await getStreamsCached(session, type, null, signal)) as unknown[];
}

async function buildTvEntries(session: StoredSession, signal?: AbortSignal): Promise<M3uItem[]> {
  const categories = await getCategoriesCached(session, 'tv', signal);
  const rawChannels = await collectStreamsForExport(session, 'tv', categories, signal);
  const categoryNames = new Map(categories.map((category) => [category.id, category.name]));

  return dedupeById(rawChannels as Channel[]).map((channel) => ({
    id: channel.id,
    name: channel.name,
    logo: channel.logo,
    category: channel.categoryId !== '' ? (categoryNames.get(channel.categoryId) ?? null) : null,
    tvgId: channel.epgId ?? channel.id,
    url: buildDirectStreamUrl(session, 'live', channel.id, session.streamFormat),
  }));
}

async function buildMovieEntries(session: StoredSession, signal?: AbortSignal): Promise<M3uItem[]> {
  const categories = await getCategoriesCached(session, 'movies', signal);
  const rawMovies = await collectStreamsForExport(session, 'movies', categories, signal);
  const categoryNames = new Map(categories.map((category) => [category.id, category.name]));

  return dedupeById(rawMovies as Movie[]).map((movie) => ({
    id: movie.id,
    name: movie.name,
    logo: movie.logo,
    category: movie.categoryId !== '' ? (categoryNames.get(movie.categoryId) ?? null) : null,
    tvgId: movie.id,
    url: buildDirectStreamUrl(session, 'movie', movie.id, movie.extension ?? 'mp4'),
  }));
}

// Series export reuses cached detail when available; otherwise stays list-level.
async function buildSeriesPayload(
  session: StoredSession,
  signal?: AbortSignal,
): Promise<Record<string, unknown>> {
  const categories = await getCategoriesCached(session, 'series', signal);
  const rawSeries = await collectStreamsForExport(session, 'series', categories, signal);
  const categoryNames = new Map(categories.map((category) => [category.id, category.name]));

  const items = dedupeById(rawSeries as SeriesSummary[]).map((series) => {
    const detail = session.catalog.seriesInfoById.get(series.id);
    return {
      id: series.id,
      name: series.name,
      cover: series.cover,
      categoryId: series.categoryId,
      categoryName: series.categoryId !== '' ? (categoryNames.get(series.categoryId) ?? null) : null,
      genre: series.genre,
      rating: series.rating,
      plot: series.plot,
      seasons: detail?.detail.seasons ?? null,
      episodes: detail?.episodes ?? null,
    };
  });

  return {
    type: 'xtream-series-export' as const,
    generatedAt: new Date().toISOString(),
    count: items.length,
    items,
  };
}

// Printable ASCII incl. spaces; control chars are rejected outright.
const CUSTOM_UA_PATTERN = /^[\x20-\x7E]{1,128}$/;

const exportQuerySchema = z
  .object({
    uaMode: z.enum(['default', 'none', 'custom']).default('default'),
    ua: z.string().trim().min(1).max(128).regex(CUSTOM_UA_PATTERN, 'Invalid User-Agent.').optional(),
  })
  .refine((value) => value.uaMode !== 'custom' || (value.ua !== undefined && value.ua.length > 0), {
    message: 'Custom mode requires a ua value.',
  });

function resolveUserAgentLine(query: unknown): string | null {
  const parsed = exportQuerySchema.safeParse(query);
  if (!parsed.success) throw validationError('Invalid export options.');
  const { uaMode, ua } = parsed.data;
  if (uaMode === 'none') return null;
  if (uaMode === 'custom') return ua as string;
  return XTREAM_USER_AGENT;
}

export async function playlistExportRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/playlist/:type', async (request, reply) => {
    const type = parseCatalogType((request.params as Record<string, unknown>).type);
    const session = requireSession(request);
    const userAgentLine = resolveUserAgentLine(request.query);
    const signal = bindAbortToRequest(request).signal;

    if (type === 'series') {
      // JSON carries no playback URLs: UA options do not apply here.
      const payload = await buildSeriesPayload(session, signal);
      reply
        .header('content-type', 'application/json; charset=utf-8')
        .header('content-disposition', `attachment; filename="${FILENAMES.series}"`);
      return JSON.stringify(payload, null, 2);
    }

    const entries =
      type === 'tv'
        ? await buildTvEntries(session, signal)
        : await buildMovieEntries(session, signal);

    reply
      .header('content-type', 'audio/x-mpegurl; charset=utf-8')
      .header(
        'content-disposition',
        `attachment; filename="${type === 'tv' ? FILENAMES.tv : FILENAMES.movies}"`,
      );
    return generateM3uPlaylist(entries, userAgentLine);
  });
}
