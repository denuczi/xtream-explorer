import { buildApp } from './app';
import { XTREAM_USER_AGENT } from './xtream/client';

const rawPort = Number.parseInt(process.env.PORT ?? '3001', 10);
const port = Number.isInteger(rawPort) && rawPort > 0 && rawPort <= 65535 ? rawPort : 3001;
const isTruthyEnv = (value: string | undefined): boolean =>
  ['1', 'true'].includes((value ?? '').toLowerCase());
const allowPrivateHosts = isTruthyEnv(process.env.ALLOW_PRIVATE_HOSTS);
const allowInsecureTls = isTruthyEnv(process.env.ALLOW_INSECURE_TLS);

async function start(): Promise<void> {
  const app = buildApp({ allowPrivateHosts, allowInsecureTls });

  await app.listen({ port, host: '127.0.0.1' });

  console.log(`[server] API listening on http://127.0.0.1:${port}`);
  console.log(`[server] User-Agent: ${XTREAM_USER_AGENT}`);
  if (allowPrivateHosts) {
    console.warn('[server] SSRF protection for private hosts is DISABLED (development mode).');
  }
  if (allowInsecureTls) {
    console.warn('[server] TLS certificate validation is DISABLED (development mode).');
  }
}

async function shutdown(): Promise<void> {
  process.exit(0);
}

process.on('SIGINT', () => void shutdown());
process.on('SIGTERM', () => void shutdown());

void start().catch((error) => {
  console.error('[server] failed to start:', (error as Error)?.message ?? error);
  process.exit(1);
});
