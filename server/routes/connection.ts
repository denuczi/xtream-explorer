import type { FastifyInstance } from 'fastify';
import { normalizeServerUrl } from '../xtream/url';
import { XtreamClient, assertUsableAccount, mapUserInfoToAccount } from '../xtream/client';
import { sessionStore } from '../services/session-store';
import { CONNECTION_ID_HEADER, connectionRequestSchema, readConnectionIdHeader } from '../schemas/connection';
import { sessionNotFoundError, validationError } from '../xtream/errors';
import { requireSession } from './session';
import { playlistStore } from '../services/playlist-store';

export interface RouteOptions {
  allowPrivateHosts: boolean;
  allowInsecureTls: boolean;
}

export async function connectionRoutes(app: FastifyInstance, options: RouteOptions): Promise<void> {
  app.post('/api/connection', async (request, reply) => {
    const parsed = connectionRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      throw validationError('One or more connection fields are invalid.');
    }

    const baseUrl = normalizeServerUrl(parsed.data.server);

    const client = new XtreamClient({
      baseUrl,
      username: parsed.data.username,
      password: parsed.data.password,
      allowPrivateHosts: options.allowPrivateHosts,
      // Env flag forces it globally; the UI toggle opts in per connection.
      allowInsecureTls: options.allowInsecureTls || parsed.data.allowInsecureTls,
    });

    // One upstream call validates SSRF policy, account state and captures
    // server_info (stream hosts often differ from the portal host).
    const bootstrap = await client.fetchBootstrap();
    assertUsableAccount(bootstrap.userInfo);
    const account = mapUserInfoToAccount(bootstrap.userInfo);

    const session = sessionStore.create(client, parsed.data.streamFormat, bootstrap.serverInfo);

    // Auto-save: upsert the playlist so restarts can reconnect by id.
    await playlistStore.upsert({
      server: baseUrl,
      username: parsed.data.username,
      password: parsed.data.password,
      streamFormat: parsed.data.streamFormat,
      allowInsecureTls: parsed.data.allowInsecureTls,
    });

    reply.code(201);
    return { connectionId: session.id, account };
  });

  app.get('/api/account', async (request) => {
    const session = requireSession(request);
    return { account: await session.client.fetchValidatedAccount() };
  });

  app.delete('/api/connection', async (request) => {
    const sessionId = readConnectionIdHeader(request.headers[CONNECTION_ID_HEADER]);
    if (sessionId === null || !sessionStore.delete(sessionId)) {
      throw sessionNotFoundError();
    }
    return { ok: true };
  });
}
