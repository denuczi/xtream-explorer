import Fastify from 'fastify';
import cors from '@fastify/cors';
import { connectionRoutes, type RouteOptions } from './routes/connection';
import { catalogRoutes } from './routes/catalog';
import { playlistRoutes } from './routes/playlists';
import { playbackRoutes } from './routes/playback';
import { playlistExportRoutes } from './routes/playlist-export';
import { healthRoutes } from './routes/health';
import { isAppError, isAbortLikeError } from './xtream/errors';

export type AppOptions = RouteOptions;

export function buildApp(options: AppOptions) {
  const app = Fastify({ logger: false });

  // Local tool: reflect any origin, but the server binds to loopback only.
  void app.register(cors, { origin: true });

  void app.register(healthRoutes);
  void app.register(connectionRoutes, {
    allowPrivateHosts: options.allowPrivateHosts,
    allowInsecureTls: options.allowInsecureTls,
  });
  void app.register(catalogRoutes);
  void app.register(playlistRoutes, {
    allowPrivateHosts: options.allowPrivateHosts,
    allowInsecureTls: options.allowInsecureTls,
  });
  void app.register(playlistExportRoutes);
  void app.register(playbackRoutes, {
    allowPrivateHosts: options.allowPrivateHosts,
    allowInsecureTls: options.allowInsecureTls,
  });

  // Central error mapping shared by every route plugin.
  app.setErrorHandler((error, _request, reply) => {
    const err = error as Error;
    if (isAbortLikeError(error) || err.name === 'RequestAbortedError') {
      reply.code(499);
      return null; // Caller already gone; nothing to render.
    }
    if (isAppError(error)) {
      reply.code(error.httpStatus);
      return { error: { code: error.code, message: error.message } };
    }
    // Unexpected failures are logged without request bodies to avoid leaks.
    console.error('[api] unexpected error:', err?.message ?? String(error));
    reply.code(500);
    return { error: { code: 'UNKNOWN', message: 'Unexpected server error.' } };
  });

  app.setNotFoundHandler((_request, reply) => {
    reply.code(404);
    return { error: { code: 'NOT_FOUND', message: 'Unknown endpoint.' } };
  });

  return app;
}
