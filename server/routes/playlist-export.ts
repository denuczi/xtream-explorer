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

async function buildTvEntries(
  session: Parameters<typeof getStreamsCached>[0],
  signal?: AbortSignal,
): Promise<M3uItem[]> {
  const [channels, categories] = await Promise.all([
    getStreamsCached(session, 'tv', null, signal),
    getCategoriesCached(session, 'tv', signal),
  ]);
  const categoryNames = new Map(categories.map((category) => [category.id, category.name]));

  return dedupeById(channels as Channel[]).map((channel) => ({
    id: channel.id,
    name: channel.name,
    logo: channel.logo,
    category: channel.categoryId !== '' ? (categoryNames.get(channel.categoryId) ?? null) : null,
    tvgId: channel.epgId ?? channel.id,
    url: buildDirectStreamUrl(session, 'live', channel.id, session.streamFormat),
  }));
}

async function buildMovieEntries(
  session: Parameters<typeof getStreamsCached>[0],
  signal?: AbortSignal,
): Promise<M3uItem[]> {
  const [movies, categories] = await Promise.all([
    getStreamsCached(session, 'movies', null, signal),
    getCategoriesCached(session, 'movies', signal),
  ]);
  const categoryNames = new Map(categories.map((category) => [category.id, category.name]));

  return dedupeById(movies as Movie[]).map((movie) => ({
    id: movie.id,
    name: movie.name,
    logo: movie.logo,
    category: movie.categoryId !== '' ? (categoryNames.get(movie.categoryId) ?? null) : null,
    tvgId: movie.id,
    url: buildDirectStreamUrl(
      session,
      'movie',
      movie.id,
      movie.extension ?? 'mp4',
    ),
  }));
}

/**
 * Series export: full catalog as JSON. Series the user browsed carry their
 * cached seasons/episodes; the rest stay list-level to avoid hammering the
 * panel with one request per series.
 */
async function buildSeriesPayload(
  session: Parameters<typeof getStreamsCached>[0],
  signal?: AbortSignal,
): Promise<Record<string, unknown>> {
  const [seriesList, categories] = await Promise.all([
    getStreamsCached(session, 'series', null, signal),
    getCategoriesCached(session, 'series', signal),
  ]);
  const categoryNames = new Map(categories.map((category) => [category.id, category.name]));

  const items = dedupeById(seriesList as SeriesSummary[]).map((series) => {
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
