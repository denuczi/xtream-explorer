/**
 * Rewrites HLS manifests so every URI points back at our local proxy.
 *
 * hls.js resolves relative segment URIs against the manifest URL. When the
 * manifest is served through `/api/stream/...`, those relative URIs would
 * resolve against localhost and break. We absolutize each upstream URI and
 * encode it into a generic pass-through segment endpoint.
 */

export interface ManifestRewriteOptions {
  connectionId: string;
  /** Absolute URL of the manifest as fetched from upstream. */
  manifestUrl: string;
}

const SEGMENT_ROUTE = '/api/stream';

function toProxyUri(upstreamUri: string, options: ManifestRewriteOptions): string | null {
  try {
    const absolute = new URL(upstreamUri.trim(), options.manifestUrl).href;
    const encoded = Buffer.from(absolute, 'utf8').toString('base64url');
    return `${SEGMENT_ROUTE}/${options.connectionId}/seg?u=${encoded}`;
  } catch {
    return null;
  }
}

function rewriteLine(line: string, options: ManifestRewriteOptions): string {
  const trimmed = line.trim();

  // Comment/tag lines: rewrite URI="..." attributes only (EXT-X-KEY, EXT-X-MAP,
  // EXT-X-MEDIA alternate renditions — including multi-language audio).
  if (trimmed.startsWith('#')) {
    if (!line.includes('URI="')) return line;
    return line.replace(/URI="([^"]*)"/g, (match, uri: string) => {
      if (uri.trim().length === 0) return match;
      const proxied = toProxyUri(uri, options);
      return proxied === null ? match : `URI="${proxied}"`;
    });
  }

  // Plain lines are segment URIs (possibly absolute already).
  if (trimmed.length === 0) return line;
  const proxied = toProxyUri(trimmed, options);
  return proxied ?? line;
}

/** Returns the rewritten manifest; throws nothing, falls back to input on malformed lines. */
export function rewriteManifest(manifestText: string, options: ManifestRewriteOptions): string {
  return manifestText
    .split(/\r?\n/)
    .map((line) => rewriteLine(line, options))
    .join('\n');
}

/** Inverse helper used by the segment route to recover the upstream URL. */
export function decodeSegmentToken(token: string): string | null {
  try {
    const decoded = Buffer.from(token, 'base64url').toString('utf8');
    const url = new URL(decoded);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    return url.href;
  } catch {
    return null;
  }
}
