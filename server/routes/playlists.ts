import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { normalizeServerUrl } from '../xtream/url';
import { XtreamClient, assertUsableAccount, mapUserInfoToAccount } from '../xtream/client';
import { playlistNotFoundError, validationError } from '../xtream/errors';
import { playlistStore } from '../services/playlist-store';
import { sessionStore } from '../services/session-store';
import type { RouteOptions } from './connection';

const connectPlaylistRequestSchema = z.object({
  playlistId: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/),
});

export async function playlistRoutes(app: FastifyInstance, options: RouteOptions): Promise<void> {
  app.get('/api/playlists', async () => {
    await playlistStore.load();
    return { items: playlistStore.listPublic() };
  });

  app.post('/api/playlists/connect', async (request, reply) => {
    const parsed = connectPlaylistRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      throw validationError('Invalid playlist id.');
    }

    const saved = playlistStore.get(parsed.data.playlistId);
    if (saved === undefined) {
      throw playlistNotFoundError();
    }

    const client = new XtreamClient({
      baseUrl: normalizeServerUrl(saved.server),
      username: saved.username,
      password: saved.password,
      allowPrivateHosts: options.allowPrivateHosts,
      allowInsecureTls: options.allowInsecureTls || saved.allowInsecureTls,
    });

    const bootstrap = await client.fetchBootstrap();
    assertUsableAccount(bootstrap.userInfo);

    const session = sessionStore.create(client, saved.streamFormat, bootstrap.serverInfo);
    await playlistStore.touch(saved.id);

    reply.code(201);
    return {
      connectionId: session.id,
      account: mapUserInfoToAccount(bootstrap.userInfo),
      playlistId: saved.id,
    };
  });

  app.delete('/api/playlists/:id', async (request) => {
    const rawId = (request.params as Record<string, unknown>).id;
    if (typeof rawId !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(rawId)) {
      throw validationError('Invalid playlist id.');
    }
    if (!(await playlistStore.remove(rawId))) {
      throw playlistNotFoundError();
    }
    return { ok: true };
  });
}
