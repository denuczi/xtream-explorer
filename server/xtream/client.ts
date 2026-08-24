import { Agent, request } from 'undici';
import type { Dispatcher } from 'undici';
import {
  authFailedError,
  accountDisabledError,
  accountExpiredError,
  connectionRefusedError,
  connectionResetError,
  dnsFailureError,
  invalidResponseError,
  isAbortLikeError,
  networkError,
  RequestAbortedError,
  timeoutError,
  tlsError,
} from './errors';
import type { ApiErrorCode } from './errors';
import { sanitizeStreamHost } from './streams';
import { catalogActionsFor } from '../schemas/catalog';
import type { CatalogType } from '../schemas/catalog';
import {
  asFiniteNumber,
  asOptionalTrimmedString,
  asTruthyFlag,
  isRecord,
} from '../utils/coerce';

/** Default requested identifier for the Xtream player API. */
const DEFAULT_USER_AGENT = 'SparkleTV/2.3.1 (ATV R2, Android 9)';

/**
 * Configurable via .env (`XTREAM_USER_AGENT=...`). Falls back to the
 * SparkleTV default when unset or empty. Single source of truth: the API
 * client, the stream proxy and the M3U generator all use this value.
 */
export const XTREAM_USER_AGENT = process.env.XTREAM_USER_AGENT?.trim() || DEFAULT_USER_AGENT;

const CONNECT_TIMEOUT_MS = 10_000;
const HEADER_TIMEOUT_MS = 25_000;
const BODY_TIMEOUT_MS = 25_000;
const MAX_RESPONSE_BYTES = 20 * 1024 * 1024; // 20 MiB cap on JSON payloads
const MAX_REDIRECTS = 3;

const sharedDispatcher: Dispatcher = new Agent({
  connect: { timeout: CONNECT_TIMEOUT_MS },
  headersTimeout: HEADER_TIMEOUT_MS,
  bodyTimeout: BODY_TIMEOUT_MS,
});

export interface RemoteFetchOptions {
  allowPrivateHosts?: boolean;
  /** Overrides the shared dispatcher (e.g. dev-only insecure TLS agent). */
  dispatcher?: Dispatcher;
  /** Propagated to undici so upstream work stops when callers disconnect. */
  signal?: AbortSignal;
}

export interface RawUserInfo {
  [key: string]: unknown;
}

export interface ServerInfoSnapshot {
  url: string | null;
  port: number | null;
  httpsPort: number | null;
  protocol: string | null;
}

const TLS_ERROR_CODES = new Set([
  'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
  'UNABLE_TO_GET_ISSUER_CERT_LOCALLY',
  'UNABLE_TO_GET_ISSUER_CERT',
  'SELF_SIGNED_CERT_IN_CHAIN',
  'DEPTH_ZERO_SELF_SIGNED_CERT',
  'CERT_HAS_EXPIRED',
  'CERT_NOT_YET_VALID',
  'ERR_TLS_CERT_ALTNAME_INVALID',
  'ERR_SSL_WRONG_VERSION_NUMBER',
]);

/**
 * Maps a low-level network failure to a stable API error code.
 * Pure and unit-tested; never inspects message bodies that could
 * contain URLs or credentials — only errno-style constants.
 */
export function classifyNetworkErrorCode(error: unknown): ApiErrorCode {
  const code = (error as NodeJS.ErrnoException | null)?.code ?? '';
  const name = (error as Error | null)?.name ?? '';

  if (code === 'ENOTFOUND' || code === 'EAI_AGAIN') return 'DNS_FAILURE';
  if (code === 'ECONNREFUSED') return 'CONNECTION_REFUSED';
  if (code === 'ECONNRESET' || code === 'EPIPE' || code === 'UND_ERR_SOCKET') {
    return 'CONNECTION_RESET';
  }
  if (
    code === 'UND_ERR_CONNECT_TIMEOUT' ||
    code === 'UND_ERR_HEADERS_TIMEOUT' ||
    code === 'UND_ERR_BODY_TIMEOUT' ||
    code === 'ETIMEDOUT'
  ) {
    return 'TIMEOUT';
  }
  if (TLS_ERROR_CODES.has(code) || name === 'ConnectTlsError') return 'TLS_ERROR';

  return 'NETWORK_ERROR';
}

/** Maps low-level failures to typed AppErrors (also reused by the stream proxy). */
export function describeNetworkError(error: unknown): never {
  const code = classifyNetworkErrorCode(error);
  if (code === 'DNS_FAILURE') throw dnsFailureError();
  if (code === 'CONNECTION_REFUSED') throw connectionRefusedError();
  if (code === 'CONNECTION_RESET') throw connectionResetError();
  if (code === 'TIMEOUT') throw timeoutError();
  if (code === 'TLS_ERROR') throw tlsError();
  throw networkError();
}

/**
 * Performs a JSON request guarded by full SSRF validation, re-validating
 * every redirect hop (including fresh DNS resolution) before following it.
 * Scheme transitions are treated equally — no http/https discrimination.
 */
export async function fetchJsonGuarded(url: URL, options: RemoteFetchOptions): Promise<unknown> {
  // Imported lazily to keep this module's dependency graph simple in tests.
  const { validateRemoteUrl, resolveRedirect } = await import('../security/ssrf');

  let current = await validateRemoteUrl(url, options);

  for (let hops = 0; ; hops += 1) {
    let response;
    try {
      response = await request(current, {
        dispatcher: options.dispatcher ?? sharedDispatcher,
        signal: options.signal,
        headers: {
          'user-agent': XTREAM_USER_AGENT,
          accept: 'application/json',
        },
      });
    } catch (error) {
      if (isAbortLikeError(error)) {
        throw new RequestAbortedError();
      }
      describeNetworkError(error);
    }

    const status = response.statusCode;
    const isRedirect = status === 301 || status === 302 || status === 303 || status === 307 || status === 308;

    if (isRedirect) {
      await response.body.dump();
      if (hops >= MAX_REDIRECTS) {
        throw invalidResponseError('Too many redirects from the upstream server.');
      }
      const rawLocation = response.headers.location;
      const location = Array.isArray(rawLocation) ? (rawLocation[0] ?? null) : (rawLocation ?? null);
      current = resolveRedirect(current, location);
      current = await validateRemoteUrl(current, options);
      continue;
    }

    if (status === 401 || status === 403) {
      void response.body.dump().catch(() => undefined);
      throw authFailedError();
    }

    if (status < 200 || status > 299) {
      void response.body.dump().catch(() => undefined);
      throw invalidResponseError(`The server responded with HTTP ${status}.`);
    }

    const text = await readBodyCapped(response);
    try {
      return JSON.parse(text) as unknown;
    } catch {
      throw invalidResponseError('The server returned an unsupported payload.');
    }
  }
}

async function readBodyCapped(response: { body: AsyncIterable<Uint8Array> }): Promise<string> {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of response.body) {
    total += chunk.byteLength;
    if (total > MAX_RESPONSE_BYTES) {
      throw invalidResponseError('The server response is too large.');
    }
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString('utf8');
}

/* ------------------------------------------------------------------ */
/* Pure mapping helpers (unit-tested without network access)           */
/* ------------------------------------------------------------------ */

function unixSecondsToIso(value: unknown): string | null {
  const seconds = asFiniteNumber(value);
  if (seconds === null || seconds <= 0) return null;
  const date = new Date(seconds * 1000);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export interface AccountSnapshot {
  status: string | null;
  createdAt: string | null;
  expiresAt: string | null;
  maxConnections: number | null;
  activeConnections: number | null;
}

/** Normalizes the heterogeneous `user_info` payload into our own model. */
export function mapUserInfoToAccount(raw: RawUserInfo): AccountSnapshot {
  return {
    status: asOptionalTrimmedString(raw.status),
    createdAt: unixSecondsToIso(raw.created_at),
    expiresAt: unixSecondsToIso(raw.exp_date),
    maxConnections: asFiniteNumber(raw.max_connections),
    activeConnections: asFiniteNumber(raw.active_cons),
  };
}

/**
 * Validates authentication and account state from a raw user_info object.
 * Throws a typed AppError when credentials are rejected or expired.
 */
export function assertUsableAccount(raw: RawUserInfo): void {
  const authenticated = raw.auth === undefined ? true : asTruthyFlag(raw.auth);
  if (!authenticated) {
    throw authFailedError();
  }

  const status = asOptionalTrimmedString(raw.status)?.toLowerCase() ?? '';
  if (status === 'expired') {
    throw accountExpiredError();
  }
  if (status.length > 0 && status !== 'active') {
    throw accountDisabledError();
  }
}

/* ------------------------------------------------------------------ */
/* Client                                                              */
/* ------------------------------------------------------------------ */

export interface XtreamClientOptions {
  baseUrl: string;
  username: string;
  password: string;
  allowPrivateHosts?: boolean;
  /** Development escape hatch for panels with broken TLS chains. */
  allowInsecureTls?: boolean;
}

export class XtreamClient {
  private readonly baseUrl: string;
  private readonly username: string;
  private readonly password: string;
  private readonly allowPrivateHosts: boolean;
  private readonly dispatcher?: Dispatcher;

  constructor(options: XtreamClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, '');
    this.username = options.username;
    this.password = options.password;
    this.allowPrivateHosts = options.allowPrivateHosts ?? false;
    if (options.allowInsecureTls === true) {
      this.dispatcher = new Agent({
        connect: { timeout: CONNECT_TIMEOUT_MS, rejectUnauthorized: false },
        headersTimeout: HEADER_TIMEOUT_MS,
        bodyTimeout: BODY_TIMEOUT_MS,
      });
    }
  }

  private fetchOptions(signal?: AbortSignal): RemoteFetchOptions {
    const base: RemoteFetchOptions = { allowPrivateHosts: this.allowPrivateHosts, signal };
    return this.dispatcher === undefined ? base : { ...base, dispatcher: this.dispatcher };
  }

  /** Portal origin, used as stream-host fallback when server_info is absent. */
  get portalBaseUrl(): string {
    return this.baseUrl;
  }

  /** Credentials for stream URL builders (never logged, never serialized). */
  get streamCredentials(): { username: string; password: string } {
    return { username: this.username, password: this.password };
  }

  buildPlayerApiUrl(extraParams: Record<string, string> = {}): URL {
    const url = new URL(`${this.baseUrl}/player_api.php`);
    url.searchParams.set('username', this.username);
    url.searchParams.set('password', this.password);
    for (const [key, value] of Object.entries(extraParams)) {
      url.searchParams.set(key, value);
    }
    return url;
  }

  async fetchAction(
    action: string,
    params: Record<string, string> = {},
    signal?: AbortSignal,
  ): Promise<unknown> {
    const url = this.buildPlayerApiUrl({ action, ...params });
    return fetchJsonGuarded(url, this.fetchOptions(signal));
  }

  /**
   * Calls player_api.php without action → user_info + server_info in one hit.
   */
  async fetchBootstrap(signal?: AbortSignal): Promise<{
    userInfo: RawUserInfo;
    serverInfo: ServerInfoSnapshot;
  }> {
    const payload = await fetchJsonGuarded(this.buildPlayerApiUrl(), this.fetchOptions(signal));
    if (!isRecord(payload) || !isRecord(payload.user_info)) {
      throw invalidResponseError('The account response has an unexpected shape.');
    }

    const rawServerInfo = isRecord(payload.server_info) ? payload.server_info : {};
    return {
      userInfo: payload.user_info,
      serverInfo: {
        url: sanitizeStreamHost(rawServerInfo.url),
        port: asFiniteNumber(rawServerInfo.port),
        httpsPort: asFiniteNumber(rawServerInfo.https_port),
        protocol: asOptionalTrimmedString(rawServerInfo.server_protocol),
      },
    };
  }

  /** Authenticated account snapshot, throwing typed errors when unusable. */
  async fetchValidatedAccount(signal?: AbortSignal): Promise<AccountSnapshot> {
    const { userInfo } = await this.fetchBootstrap(signal);
    assertUsableAccount(userInfo);
    return mapUserInfoToAccount(userInfo);
  }

  async fetchCatalogCategories(type: CatalogType, signal?: AbortSignal): Promise<unknown> {
    return this.fetchAction(catalogActionsFor(type).categories, {}, signal);
  }

  /** Empty categoryId → omit the param → full catalog (Xtream standard). */
  async fetchCatalogStreams(type: CatalogType, categoryId: string, signal?: AbortSignal): Promise<unknown> {
    const params: Record<string, string> =
      categoryId.length > 0 ? { category_id: categoryId } : {};
    return this.fetchAction(catalogActionsFor(type).streams, params, signal);
  }

  async fetchSeriesDetail(seriesId: string, signal?: AbortSignal): Promise<unknown> {
    return this.fetchAction('get_series_info', { series_id: seriesId }, signal);
  }

  async fetchVodDetail(vodId: string, signal?: AbortSignal): Promise<unknown> {
    return this.fetchAction('get_vod_info', { vod_id: vodId }, signal);
  }
}
