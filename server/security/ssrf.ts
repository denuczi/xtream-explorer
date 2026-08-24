import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { dnsFailureError, invalidResponseError, ssrfBlockedError } from '../xtream/errors';

export interface RemoteUrlOptions {
  /** Development escape hatch. Must stay false in any real deployment. */
  allowPrivateHosts?: boolean;
}

const BLOCKED_HOSTNAME_PATTERN =
  /^(localhost|.*\.localhost|metadata\.google\.internal|metadata\.goog)$/i;

function isBlockedIpv4(address: string): boolean {
  const octets = address.split('.').map((part) => Number.parseInt(part, 10));
  if (octets.length !== 4 || octets.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
    return true;
  }
  const [a = -1, b = -1] = octets;

  if (a === 0) return true; // 0.0.0.0/8 "this network"
  if (a === 10) return true; // RFC1918
  if (a === 127) return true; // loopback
  if (a === 169 && b === 254) return true; // link-local incl. cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return true; // RFC1918
  if (a === 192 && b === 168) return true; // RFC1918
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT 100.64/10
  if (a === 198 && (b === 18 || b === 19)) return true; // benchmarking
  if (a === 192 && b === 0 && octets[2] === 0) return true; // 192.0.0.0/24
  if (a === 192 && b === 0 && octets[2] === 2) return true; // TEST-NET-1
  if (a === 198 && b === 51 && octets[2] === 100) return true; // TEST-NET-2
  if (a === 203 && b === 0 && octets[2] === 113) return true; // TEST-NET-3
  if (a >= 224) return true; // multicast + reserved
  return false;
}

function isBlockedIpv6(rawAddress: string): boolean {
  const address = rawAddress.toLowerCase();
  if (address === '::' || address === '::1') return true; // unspecified / loopback
  if (address.startsWith('fe8') || address.startsWith('fe9') || address.startsWith('fea') || address.startsWith('feb')) {
    return true; // fe80::/10 link-local
  }
  if (address.startsWith('fc') || address.startsWith('fd')) {
    return true; // fc00::/7 unique local (incl. EC2 IPv6 metadata fd00:ec2::254)
  }
  const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/.exec(address);
  if (mapped && mapped[1]) {
    return isBlockedIpv4(mapped[1]); // IPv4-mapped
  }
  return false;
}

export function isBlockedIpAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 4) return isBlockedIpv4(address);
  if (family === 6) return isBlockedIpv6(address);
  return true; // not an IP at all → treat as unsafe
}

function stripIpv6Brackets(hostname: string): string {
  return hostname.replace(/^\[/, '').replace(/\]$/, '');
}

async function assertHostAllowed(hostname: string, options: RemoteUrlOptions): Promise<void> {
  if (options.allowPrivateHosts === true) return;

  const bareHost = stripIpv6Brackets(hostname.toLowerCase());

  if (BLOCKED_HOSTNAME_PATTERN.test(bareHost)) {
    throw ssrfBlockedError(`The host "${bareHost}" points to a restricted network.`);
  }

  const literalFamily = isIP(bareHost);
  if (literalFamily !== 0) {
    if (isBlockedIpAddress(bareHost)) {
      throw ssrfBlockedError('This address points to a restricted IP range.');
    }
    return;
  }

  let resolved: Array<{ address: string; family: number }>;
  try {
    resolved = await lookup(bareHost, { all: true, verbatim: true });
  } catch (error) {
    const code = (error as NodeJS.ErrnoException | null)?.code;
    if (code === 'ENOTFOUND' || code === 'EAI_AGAIN') {
      throw dnsFailureError();
    }
    throw dnsFailureError();
  }

  if (resolved.length === 0) {
    throw dnsFailureError();
  }

  for (const entry of resolved) {
    if (isBlockedIpAddress(entry.address)) {
      throw ssrfBlockedError('This host resolves to a restricted IP range.');
    }
  }
}

/**
 * Full SSRF validation for an outbound URL:
 * protocol allow-list, no embedded credentials, hostname block-list,
 * literal-IP checks and post-DNS re-validation of every resolved address.
 */
export async function validateRemoteUrl(rawUrl: string | URL, options: RemoteUrlOptions = {}): Promise<URL> {
  const url = typeof rawUrl === 'string' ? parseOrThrow(rawUrl) : rawUrl;

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw ssrfBlockedError(`Protocol "${url.protocol}" is not allowed.`);
  }

  if (url.username.length > 0 || url.password.length > 0) {
    throw ssrfBlockedError('Embedded credentials are not allowed in remote URLs.');
  }

  await assertHostAllowed(url.hostname, options);

  return url;
}

/**
 * Resolves one redirect hop. Absolute and relative Location values are
 * supported, and http ↔ https transitions are treated equally — no scheme
 * discrimination. Every returned URL MUST go through validateRemoteUrl
 * again before use (fresh DNS + IP policy per hop).
 */
export function resolveRedirect(currentUrl: URL, locationHeader: string | null): URL {
  if (!locationHeader || locationHeader.trim().length === 0) {
    throw invalidResponseError('The server sent a redirect without a target.');
  }

  let next: URL;
  try {
    next = new URL(locationHeader.trim(), currentUrl);
  } catch {
    throw invalidResponseError('The server sent a malformed redirect.');
  }

  return next;
}

function parseOrThrow(raw: string): URL {
  try {
    return new URL(raw);
  } catch {
    throw invalidResponseError('A remote URL could not be parsed.');
  }
}
