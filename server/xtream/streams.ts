import type { StoredSession } from '../services/session-store';

export type StreamKind = 'live' | 'movie' | 'series';

const KIND_PATHS: Record<StreamKind, string> = {
  live: 'live',
  movie: 'movie',
  series: 'series',
};

const DEFAULT_PORTS: Record<'http' | 'https', number> = { http: 80, https: 443 };

function formatStreamBase(protocol: 'http' | 'https', host: string, port: number | null): string {
  const isDefaultPort = port === null || port === DEFAULT_PORTS[protocol];
  return `${protocol}://${host}${isDefaultPort ? '' : `:${port}`}`;
}

/**
 * Normalizes the loosely-shaped `server_info.url` field ONCE at ingestion:
 * some panels send a bare host ('satel.lat'), others a full origin
 * ('http://junglemuff.best'), others garbage. Returns just the hostname,
 * or null when unusable (callers fall back to the portal origin).
 */
export function sanitizeStreamHost(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (trimmed.length === 0) return null;

  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const parsed = new URL(trimmed);
      return parsed.hostname.length > 0 ? parsed.hostname.toLowerCase() : null;
    } catch {
      return null;
    }
  }

  // Bare host: reject anything that cannot be one (paths, queries, spaces).
  if (/[/?#@\s]/.test(trimmed)) return null;
  return trimmed.toLowerCase();
}

/**
 * Xtream serves streams from the host advertised in server_info
 * (often different from the portal host). Falls back to the portal
 * origin when the panel did not provide one. Default ports are omitted
 * for clean, VLC-friendly URLs.
 */
export function resolveStreamBase(session: StoredSession): string {
  const info = session.serverInfo;
  if (info !== null && info.url !== null) {
    const protocol: 'http' | 'https' = info.protocol === 'https' ? 'https' : 'http';
    const port = protocol === 'https' ? info.httpsPort : info.port;
    return formatStreamBase(protocol, info.url, port);
  }
  return session.client.portalBaseUrl;
}

export function buildDirectStreamUrl(
  session: StoredSession,
  kind: StreamKind,
  id: string,
  extension: string,
): string {
  const { username, password } = session.client.streamCredentials;
  const encodedId = encodeURIComponent(id);
  const encodedExt = encodeURIComponent(extension);
  return (
    `${resolveStreamBase(session)}/${KIND_PATHS[kind]}/` +
    `${encodeURIComponent(username)}/${encodeURIComponent(password)}/` +
    `${encodedId}.${encodedExt}`
  );
}

/** Local proxy URL consumed by the <video> element (no custom headers needed). */
export function buildProxyUrl(
  sessionId: string,
  kind: StreamKind,
  id: string,
  extension: string,
  downloadName?: string,
): string {
  const params = new URLSearchParams();
  if (downloadName !== undefined) {
    params.set('dl', '1');
    params.set('name', downloadName);
  }
  const query = params.size > 0 ? `?${params.toString()}` : '';
  return (
    `/api/stream/${sessionId}/${kind}/${encodeURIComponent(id)}/` +
    `${encodeURIComponent(extension)}${query}`
  );
}
