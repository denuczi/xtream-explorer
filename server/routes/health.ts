import type { FastifyInstance } from 'fastify';
import { XTREAM_USER_AGENT } from '../xtream/client';

export async function healthRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/health', async () => {
    return { status: 'ok' as const };
  });

 
  app.get('/api/app-config', async () => {
    return { defaultUserAgent: XTREAM_USER_AGENT };
  });
}
