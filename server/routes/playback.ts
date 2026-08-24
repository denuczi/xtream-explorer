import { pipeline } from 'node:stream/promises';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { request as undiciRequest } from 'undici';
import {
  invalidResponseError,
  isAbortLikeError,
  isAppError,
  RequestAbortedError,
  sessionNotFoundError,
  validationError,
} from '../xtream/errors';
import type { AppError } from '../xtream/errors';
import { XTREAM_USER_AGENT, describeNetworkError } from '../xtream/client';
import { buildDirectStreamUrl, buildProxyUrl } from '../xtream/streams';
import { decodeSegmentToken, rewriteManifest } from '../xtream/hls-rewrite';
import type { StreamKind } from '../xtream/streams';
import { mapVodInfo } from '../xtream/mappers/catalog';
import type { VodDetail } from '../schemas/catalog';
import { resolveRedirect } from '../security/ssrf';
import { validateRemoteUrl } from '../security/ssrf';
import { bindAbortToRequest, parseCatalogType, parseSafeIdParam, requireSession } from './session';
import type { RouteOptions } from './connection';
import { sessionStore, type StoredSession } from '../services/session-store';

const KIND_BY_TYPE = { tv: 'live', movies: 'movie', series: 'series' } as const;

/** Origins already SSRF-cleared in this process (DNS per video segment would be too costly). */
const clearedOrigins = new Set<string>();

async function assertStreamOriginAllowed(
  directUrl: string,
  options: { allowPrivateHosts?: boolean },
): Promise<void> {
  const origin = new URL(directUrl).origin;
  if (clearedOrigins.has(origin)) return;
  await validateRemoteUrl(`${origin}/`, options);
  clearedOrigins.add(origin);
}

function findCachedEpisodeExtension(session: StoredSession, episodeId: string): string | null {
  for (const entry of session.catalog.seriesInfoById.values()) {
    const match = entry.episodes.find((episode) => episode.id === episodeId);
    if (match !== undefined) return match.extension;
  }
  return null;
}

async function loadVodDetail(
  session: StoredSession,
  vodId: string,
  signal?: AbortSignal,
): Promise<VodDetail> {
  const cached = session.catalog.vodInfoById.get(vodId);
  if (cached !== undefined) return cached;

  const raw = await session.client.fetchVodDetail(vodId, signal);
  const detail = mapVodInfo(vodId, raw);
  session.catalog.vodInfoById.set(vodId, detail);
  return detail;
}

const PROXIED_HEADERS = [
  'content-type',
  'content-length',
  'content-range',
  'accept-ranges',
  'etag',
  'last-modified',
];

const DOWNLOAD_NAME_PATTERN = /^[\w .-]{1,80}$/;
const MANIFEST_EXTENSIONS = new Set(['m3u8', 'm3u']);
const MAX_MANIFEST_BYTES = 4 * 1024 * 1024;
const MAX_REDIRECTS_STREAM = 3;

interface PipeOptions {
  allowPrivateHosts?: boolean;
  /** When set, HLS manifests are rewritten so segments loop back to the proxy. */
  manifestConnectionId?: string | null;
  downloadName?: string | null;
}

async function readBodyCapped(response: { body: AsyncIterable<Uint8Array> }, cap: number): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of response.body) {
    total += chunk.byteLength;
    if (total > cap) throw invalidResponseError('Upstream response is too large.');
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

/**
 * Shared streaming core: validates the URL (SSRF, per-redirect), follows the
 * redirect policy, then hijacks the reply and pipes bytes. When
 * `manifestConnectionId` is set and the payload is an HLS manifest, segment/
 * key/rendition URIs are rewritten to the local seg endpoint.
 */
async function pipeUpstreamToReply(
  request: FastifyRequest,
  reply: FastifyReply,
  startUrl: string,
  pipeOptions: PipeOptions,
): Promise<void> {
  const rangeHeader = request.headers.range;

  let current = await validateRemoteUrl(startUrl, pipeOptions);
  let upstream;
  for (let hops = 0; ; hops += 1) {
    try {
      upstream = await undiciRequest(current, {
        headers: {
          'user-agent': XTREAM_USER_AGENT,
          ...(typeof rangeHeader === 'string' ? { range: rangeHeader } : {}),
        },
      });
    } catch (error) {
      if (isAbortLikeError(error)) throw new RequestAbortedError();
      describeNetworkError(error);
    }

    const status = upstream.statusCode;
    if ([301, 302, 303, 307, 308].includes(status)) {
      await upstream.body.dump();
      if (hops >= MAX_REDIRECTS_STREAM) {
        throw invalidResponseError('Too many redirects while fetching the stream.');
      }
      const rawLocation = upstream.headers.location;
      const location = Array.isArray(rawLocation) ? (rawLocation[0] ?? null) : (rawLocation ?? null);
      current = resolveRedirect(current, location);
      current = await validateRemoteUrl(current, pipeOptions);
      continue;
    }
    break;
  }

  const upstreamContentType = Array.isArray(upstream.headers['content-type'])
    ? (upstream.headers['content-type'][0] ?? '')
    : (upstream.headers['content-type'] ?? '');
  const isManifestPayload =
    pipeOptions.manifestConnectionId !== undefined &&
    upstreamContentType.toLowerCase().includes('mpegurl');

  reply.hijack();

  try {
    const headers: Record<string, string | string[]> = {};
    for (const key of PROXIED_HEADERS) {
      if (key === 'content-length' && isManifestPayload) continue; // recomputed below
      const value = upstream.headers[key];
      if (value !== undefined) headers[key] = value;
    }
    if (pipeOptions.downloadName !== undefined && pipeOptions.downloadName !== null) {
      headers['content-disposition'] =
        `attachment; filename="${pipeOptions.downloadName.replace(/"/g, '')}"; filename*=UTF-8''${encodeURIComponent(
          pipeOptions.downloadName,
        )}`;
    }

    if (isManifestPayload) {
      // Buffer + rewrite: hls.js must resolve every URI against our proxy.
      const body = await readBodyCapped(upstream, MAX_MANIFEST_BYTES);
      const rewritten = rewriteManifest(body.toString('utf8'), {
        connectionId: pipeOptions.manifestConnectionId as string,
        manifestUrl: current.href,
      });
      const payload = Buffer.from(rewritten, 'utf8');
      headers['content-type'] = 'application/vnd.apple.mpegurl';
      headers['content-length'] = String(payload.byteLength);
      reply.raw.writeHead(upstream.statusCode, headers);
      reply.raw.end(payload);
      return;
    }

    reply.raw.writeHead(upstream.statusCode, headers);

    const clientGone = new AbortController();
    const handleClose = (): void => clientGone.abort();
    request.raw.on('close', handleClose);

    try {
      await pipeline(upstream.body as AsyncIterable<Uint8Array>, reply.raw, {
        signal: clientGone.signal,
      });
    } catch (pipeError) {
      if (!clientGone.signal.aborted) {
        console.warn('[proxy] pipeline ended early:', (pipeError as Error)?.message);
      }
    } finally {
      request.raw.off('close', handleClose);
      if (!reply.raw.writableEnded) reply.raw.end();
    }
  } catch (error) {
    if (!reply.raw.headersSent) {
      const appError: AppError | null = isAppError(error) ? error : null;
      reply.raw.writeHead(appError?.httpStatus ?? 502, { 'content-type': 'application/json' });
      reply.raw.end(
        JSON.stringify({
          error: {
            code: appError?.code ?? 'NETWORK_ERROR',
            message: appError?.message ?? 'Streaming failed.',
          },
        }),
      );
    } else {
      reply.raw.destroy();
    }
  }
}

/** One-time negotiation of the playable extension for a live channel. */
async function negotiateLiveExtension(
  session: StoredSession,
  channelId: string,
  options: RouteOptions,
  signal?: AbortSignal,
): Promise<string> {
  const cached = session.catalog.liveExtensionByChannel.get(channelId);
  if (cached !== undefined) return cached;

  const candidates: string[] = ['m3u8', 'ts'];
  let chosen = 'm3u8';
  try {
    for (const candidate of candidates) {
      const url = buildDirectStreamUrl(session, 'live', channelId, candidate);
      await assertStreamOriginAllowed(url, options);
      try {
        const probe = await undiciRequest(url, {
          headers: { 'user-agent': XTREAM_USER_AGENT },
          signal,
        });
        const ok = probe.statusCode >= 200 && probe.statusCode < 400;
        await probe.body.dump().catch(() => undefined);
        if (ok) {
          chosen = candidate;
          break;
        }
      } catch (error) {
        if (signal?.aborted || isAbortLikeError(error)) throw new RequestAbortedError();
        // Network-level failure on one candidate: try the next one.
      }
    }
  } finally {
    session.catalog.liveExtensionByChannel.set(channelId, chosen);
  }
  return chosen;
}

export async function playbackRoutes(app: FastifyInstance, options: RouteOptions): Promise<void> {
  /** Resolves playback targets (direct + local proxy) for one item. */
  app.get('/api/playable/:type/:id', async (request) => {
    const params = request.params as Record<string, unknown>;
    const type = parseCatalogType(params.type);
    const id = parseSafeIdParam(params.id, 'item id');
    const session = requireSession(request);
    const signal = bindAbortToRequest(request).signal;

    const kind: StreamKind = KIND_BY_TYPE[type];
    let extension: string;

    if (kind === 'live') {
      extension = await negotiateLiveExtension(session, id, options, signal);
    } else if (kind === 'movie') {
      const detail = await loadVodDetail(session, id, signal);
      extension = detail.extension ?? 'mp4';
    } else {
      extension = findCachedEpisodeExtension(session, id) ?? 'mp4';
    }

    const directUrl = buildDirectStreamUrl(session, kind, id, extension);
    const copyUrl =
      kind === 'live'
        ? buildDirectStreamUrl(session, 'live', id, session.streamFormat)
        : directUrl;

    return {
      kind,
      id,
      extension,
      directUrl,
      copyUrl,
      proxyUrl: buildProxyUrl(session.id, kind, id, extension),
    };
  });

  /** Normalized movie metadata for the player info section. */
  app.get('/api/vod/:id', async (request) => {
    const id = parseSafeIdParam((request.params as Record<string, unknown>).id, 'movie id');
    const session = requireSession(request);
    const signal = bindAbortToRequest(request).signal;
    return { movie: await loadVodDetail(session, id, signal) };
  });

  /**
   * Streaming proxy: <video>/hls.js consume this URL. HLS manifests are
   * transparently rewritten (see rewriteManifest) so segments loop back here.
   */
  app.get('/api/stream/:connectionId/:kind/:id/:ext', async (request, reply) => {
    const params = request.params as Record<string, unknown>;
    const connectionId =
      typeof params.connectionId === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(params.connectionId)
        ? params.connectionId
        : null;
    if (connectionId === null) throw validationError('Invalid connection id.');

    if (params.kind !== 'live' && params.kind !== 'movie' && params.kind !== 'series') {
      throw validationError('Unknown stream kind.');
    }
    const kind: StreamKind = params.kind;

    const id = parseSafeIdParam(params.id, 'stream id');
    if (typeof params.ext !== 'string' || !/^[a-z0-9]{2,5}$/i.test(params.ext)) {
      throw validationError('Invalid stream extension.');
    }
    const extension = params.ext.toLowerCase();

    const session = sessionStore.get(connectionId);
    if (session === undefined) throw sessionNotFoundError();

    const searchParams = new URL(request.raw.url ?? '/', 'http://local').searchParams;
    const downloadFlag = searchParams.get('dl') === '1';
    const rawName = searchParams.get('name') ?? '';
    const downloadName =
      downloadFlag && DOWNLOAD_NAME_PATTERN.test(rawName) ? rawName.trim() : `video.${extension}`;

    const directUrl = buildDirectStreamUrl(session, kind, id, extension);
    await assertStreamOriginAllowed(directUrl, options);

    await pipeUpstreamToReply(request, reply, directUrl, {
      allowPrivateHosts: options.allowPrivateHosts,
      manifestConnectionId: MANIFEST_EXTENSIONS.has(extension) ? connectionId : null,
      downloadName: downloadFlag ? downloadName : null,
    });
  });

  /**
   * Generic pass-through for URIs found inside rewritten manifests
   * (segments, encryption keys, alternate audio renditions).
   * Token travels as a query param: upstream URIs with long tokens would
   * otherwise exceed Fastify's route param length limit (HTTP 414).
   */
  app.get('/api/stream/:connectionId/seg', async (request, reply) => {
    const params = request.params as Record<string, unknown>;
    const connectionId =
      typeof params.connectionId === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(params.connectionId)
        ? params.connectionId
        : null;
    if (connectionId === null) throw validationError('Invalid connection id.');
    if (sessionStore.get(connectionId) === undefined) throw sessionNotFoundError();

    const token = new URL(request.raw.url ?? '/', 'http://local').searchParams.get('u') ?? '';
    if (!/^[A-Za-z0-9_-]{8,4096}$/.test(token)) {
      throw validationError('Invalid segment token.');
    }

    const targetUrl = decodeSegmentToken(token);
    if (targetUrl === null) throw validationError('Invalid segment token.');

    // Origin policy applies exactly like the main proxy.
    await assertStreamOriginAllowed(targetUrl, options);

    // Alternate renditions (multi-language audio) are themselves HLS
    // manifests: rewrite them too when upstream says mpegurl.
    await pipeUpstreamToReply(request, reply, targetUrl, {
      allowPrivateHosts: options.allowPrivateHosts,
      manifestConnectionId: connectionId,
    });
  });
}
