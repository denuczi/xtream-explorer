import type { FastifyInstance, FastifyRequest } from 'fastify';
import {
  mapCategories,
  mapLiveStreams,
  mapSeriesInfo,
  mapSeriesList,
  mapVodStreams,
} from '../xtream/mappers/catalog';
import type { CatalogType } from '../schemas/catalog';
import { bindAbortToRequest, parseCatalogType, parseSafeIdParam, requireSession } from './session';
import type { StoredSession } from '../services/session-store';

const ALL_CATEGORY_KEY = 'all';

function streamsCacheKey(type: CatalogType, categoryId: string): string {
  return `${type}:${categoryId}`;
}

/** Shared cache-fill used by the catalog routes and the playlist exporter. */
export async function getCategoriesCached(
  session: StoredSession,
  type: CatalogType,
  signal?: AbortSignal,
) {
  const cached = session.catalog.categories.get(type);
  if (cached !== undefined) return cached;

  const raw = await session.client.fetchCatalogCategories(type, signal);
  const items = mapCategories(raw);
  session.catalog.categories.set(type, items);
  return items;
}

export async function getStreamsCached(
  session: StoredSession,
  type: CatalogType,
  categoryId: string | null,
  signal?: AbortSignal,
) {
  const cacheId = categoryId ?? ALL_CATEGORY_KEY;
  const key = streamsCacheKey(type, cacheId);
  const cached = session.catalog.streamsByCategoryKey.get(key);
  if (cached !== undefined) return cached;

  const raw = await session.client.fetchCatalogStreams(type, categoryId ?? '', signal);
  let items;
  if (type === 'tv') {
    items = mapLiveStreams(raw);
  } else if (type === 'movies') {
    items = mapVodStreams(raw);
  } else {
    items = mapSeriesList(raw);
  }
  session.catalog.streamsByCategoryKey.set(key, items);
  return items;
}

async function loadStreams(request: FastifyRequest, type: CatalogType, categoryId: string | null) {
  const session = requireSession(request);
  const signal = bindAbortToRequest(request).signal;
  return { items: await getStreamsCached(session, type, categoryId, signal) };
}

export async function catalogRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/categories/:type', async (request) => {
    const type = parseCatalogType((request.params as Record<string, unknown>).type);
    const session = requireSession(request);
    const signal = bindAbortToRequest(request).signal;
    return { items: await getCategoriesCached(session, type, signal) };
  });

  // Full catalog for a type (used by content search).
  app.get('/api/streams/:type', async (request) => {
    const type = parseCatalogType((request.params as Record<string, unknown>).type);
    return loadStreams(request, type, null);
  });

  app.get('/api/streams/:type/:categoryId', async (request) => {
    const params = request.params as Record<string, unknown>;
    const type = parseCatalogType(params.type);
    const categoryId = parseSafeIdParam(params.categoryId, 'category id');
    return loadStreams(request, type, categoryId);
  });

  /** Normalized series detail (drill-down + player next-episode context). */
  app.get('/api/series/:seriesId', async (request) => {
    const seriesId = parseSafeIdParam((request.params as Record<string, unknown>).seriesId, 'series id');
    const session = requireSession(request);
    const signal = bindAbortToRequest(request).signal;

    const cached = session.catalog.seriesInfoById.get(seriesId);
    if (cached !== undefined) {
      return { series: cached.detail };
    }

    const raw = await session.client.fetchSeriesDetail(seriesId, signal);
    const detail = mapSeriesInfo(seriesId, raw);
    session.catalog.seriesInfoById.set(seriesId, {
      detail,
      seasons: detail.seasons,
      episodes: detail.episodes,
    });
    return { series: detail };
  });
}
