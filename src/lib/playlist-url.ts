import type { StreamFormat } from '../types/models';

export interface ParsedPlaylistUrl {
  baseUrl: string;
  username: string;
  password: string;
  /** Present only when the URL pins a concrete live format via `output=ts`. */
  outputFormat: StreamFormat | null;
}

/**
 * Detects full playlist URLs pasted into the server field:
 *   http://host:port/get.php?username=u&password=p&type=m3u_plus[&output=ts]
 *   http://host:port/player_api.php?username=u&password=p
 *
 * `type` (m3u_plus, m3u, ts…) does NOT force the stream format - only an
 * explicit `output=ts` does. Everything else keeps the user's selection.
 */
const PLAYLIST_URL_PATTERN = /^https?:\/\/[^/?#\s]+\/(?:get|player_api)\.php\?(.*)$/i;

export function parsePlaylistUrl(rawInput: string): ParsedPlaylistUrl | null {
  const trimmed = rawInput.trim();
  const match = PLAYLIST_URL_PATTERN.exec(trimmed);
  if (match === null || match[1] === undefined) return null;

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }

  const username = (url.searchParams.get('username') ?? '').trim();
  const password = (url.searchParams.get('password') ?? '').trim();
  if (username.length === 0 || password.length === 0) return null;

  const output = (url.searchParams.get('output') ?? '').trim().toLowerCase();
  const outputFormat: StreamFormat | null = output === 'ts' ? 'ts' : null;

  return { baseUrl: url.origin, username, password, outputFormat };
}
