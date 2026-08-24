import { XTREAM_USER_AGENT } from '../xtream/client';

export interface M3uItem {
  id: string;
  name: string;
  logo: string | null;
  /** Category name for group-title (omitted when absent). */
  category: string | null;
  /** EPG identifier for live channels; falls back to the item id. */
  tvgId: string | null;
  url: string;
}

/** Escapes attribute values and strips line breaks from display names. */
export function escapeM3uAttribute(value: string): string {
  return value.replace(/"/g, '\\"').replace(/\r?\n/g, ' ');
}

function sanitizeDisplayName(value: string): string {
  return value.replace(/\r?\n/g, ' ').trim();
}

/**
 * `userAgentLine` controls the pipe suffix players like VLC may reject:
 *   - string → appended as `|User-Agent=<value>`
 *   - null   → omitted entirely (clean link)
 */
export function generateM3uEntry(item: M3uItem, userAgentLine: string | null = XTREAM_USER_AGENT): string {
  const attributes = [`tvg-id="${escapeM3uAttribute(item.tvgId ?? item.id)}"`];
  if (item.logo !== null && item.logo.length > 0) {
    attributes.push(`tvg-logo="${escapeM3uAttribute(item.logo)}"`);
  }
  if (item.category !== null && item.category.length > 0) {
    attributes.push(`group-title="${escapeM3uAttribute(item.category)}"`);
  }

  const displayName = sanitizeDisplayName(item.name).length > 0
    ? sanitizeDisplayName(item.name)
    : sanitizeDisplayName(item.id);

  const suffix = userAgentLine === null ? '' : `|User-Agent=${userAgentLine}`;
  return `#EXTINF:-1 ${attributes.join(' ')},${displayName}\n${item.url}${suffix}`;
}

/**
 * LF-normalized playlist with exactly one #EXTM3U header.
 * Pass `null` through to omit User-Agent pipes on every entry.
 */
export function generateM3uPlaylist(
  items: M3uItem[],
  userAgentLine: string | null = XTREAM_USER_AGENT,
): string {
  const lines = ['#EXTM3U'];
  for (const item of items) {
    lines.push(generateM3uEntry(item, userAgentLine));
  }
  return `${lines.join('\n')}\n`;
}
