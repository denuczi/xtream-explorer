export type ApiErrorCode =
  | 'INVALID_URL'
  | 'SSRF_BLOCKED'
  | 'AUTH_FAILED'
  | 'ACCOUNT_EXPIRED'
  | 'ACCOUNT_DISABLED'
  | 'TIMEOUT'
  | 'DNS_FAILURE'
  | 'CONNECTION_REFUSED'
  | 'CONNECTION_RESET'
  | 'TLS_ERROR'
  | 'INVALID_RESPONSE'
  | 'NETWORK_ERROR'
  | 'VALIDATION_ERROR'
  | 'SESSION_NOT_FOUND'
  | 'PLAYLIST_NOT_FOUND'
  | 'UNKNOWN';

/**
 * Application-level error carrying a stable machine code and the HTTP status
 * the API should respond with. Messages must never contain credentials.
 */
export class AppError extends Error {
  readonly code: ApiErrorCode;
  readonly httpStatus: number;

  constructor(code: ApiErrorCode, httpStatus: number, message: string) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

export const invalidUrlError = (detail: string): AppError =>
  new AppError('INVALID_URL', 400, detail);

export const ssrfBlockedError = (detail: string): AppError =>
  new AppError('SSRF_BLOCKED', 403, detail);

export const authFailedError = (): AppError =>
  new AppError('AUTH_FAILED', 401, 'The server rejected these credentials.');

export const accountExpiredError = (): AppError =>
  new AppError('ACCOUNT_EXPIRED', 401, 'This Xtream account has expired.');

export const accountDisabledError = (): AppError =>
  new AppError('ACCOUNT_DISABLED', 401, 'This Xtream account is not active.');

export const timeoutError = (): AppError =>
  new AppError('TIMEOUT', 504, 'The Xtream server did not respond in time.');

export const dnsFailureError = (): AppError =>
  new AppError('DNS_FAILURE', 502, 'The Xtream server address could not be resolved.');

export const connectionRefusedError = (): AppError =>
  new AppError('CONNECTION_REFUSED', 502, 'The connection was refused by the Xtream server.');

export const connectionResetError = (): AppError =>
  new AppError('CONNECTION_RESET', 502, 'The connection was reset by the Xtream server.');

export const tlsError = (): AppError =>
  new AppError('TLS_ERROR', 502, 'The Xtream server presented an invalid TLS certificate.');

export const invalidResponseError = (detail: string): AppError =>
  new AppError('INVALID_RESPONSE', 502, detail);

export const networkError = (): AppError =>
  new AppError('NETWORK_ERROR', 502, 'A network error occurred while contacting the server.');

export const validationError = (detail: string): AppError =>
  new AppError('VALIDATION_ERROR', 400, detail);

export const sessionNotFoundError = (): AppError =>
  new AppError('SESSION_NOT_FOUND', 404, 'This connection session no longer exists.');

export const playlistNotFoundError = (): AppError =>
  new AppError('PLAYLIST_NOT_FOUND', 404, 'That saved playlist no longer exists.');

export function isAppError(value: unknown): value is AppError {
  return value instanceof AppError;
}

/** Raised when the inbound caller aborted while we were still fetching upstream. */
export class RequestAbortedError extends Error {
  constructor() {
    super('The request was cancelled.');
    this.name = 'RequestAbortedError';
  }
}

export function isAbortLikeError(value: unknown): boolean {
  if (value instanceof RequestAbortedError) return true;
  const code = (value as NodeJS.ErrnoException | null)?.code;
  const name = (value as Error | null)?.name;
  return code === 'ABORT_ERR' || name === 'AbortError';
}
