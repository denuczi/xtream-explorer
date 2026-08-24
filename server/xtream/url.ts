import { invalidUrlError } from './errors';

/**
 * Normalizes a user-provided server address into a clean origin string.
 *
 * Accepted inputs:
 *   http://server.com:80 | https://server.com | server.com:80 | server.com
 *
 * Rules:
 *   - trims surrounding whitespace
 *   - defaults to http:// when no protocol is given
 *   - rejects embedded credentials, query strings and hashes
 *   - allows at most one simple path segment (e.g. "/c/" used by some panels)
 *   - keeps an explicit non-default port
 */
const OPTIONAL_SINGLE_SEGMENT = /^\/[A-Za-z0-9][A-Za-z0-9._-]{0,31}(\/)?$/;

export function normalizeServerUrl(rawInput: string): string {
  const trimmed = rawInput.trim();
  if (trimmed.length === 0) {
    throw invalidUrlError('The server address is empty.');
  }

  const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`;

  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    throw invalidUrlError('The server address could not be parsed.');
  }

  if (url.username.length > 0 || url.password.length > 0) {
    throw invalidUrlError('Embedded credentials are not allowed in the server address.');
  }

  if (url.search.length > 0 || url.hash.length > 0) {
    throw invalidUrlError('The server address must not contain query strings or fragments.');
  }

  let basePath = '';
  const pathname = url.pathname;
  if (pathname !== '/' && pathname !== '') {
    if (!OPTIONAL_SINGLE_SEGMENT.test(pathname)) {
      throw invalidUrlError('The server address may contain at most one simple path segment.');
    }
    basePath = pathname.replace(/\/+$/, '');
  }

  if (url.hostname.length === 0) {
    throw invalidUrlError('The server host is missing.');
  }

  return `${url.origin}${basePath}`;
}
