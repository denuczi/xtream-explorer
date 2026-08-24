import type { FastifyRequest } from 'fastify';
import { readConnectionIdHeader } from '../schemas/connection';
import { sessionNotFoundError, validationError } from '../xtream/errors';
import { sessionStore, type StoredSession } from '../services/session-store';
import { catalogTypeSchema } from '../schemas/catalog';

export function requireSession(request: FastifyRequest): StoredSession {
  const sessionId = readConnectionIdHeader(request.headers['x-connection-id']);
  const session = sessionId === null ? undefined : sessionStore.get(sessionId);
  if (!session) {
    throw sessionNotFoundError();
  }
  return session;
}

/** Attaches an AbortController that fires when the inbound request closes. */
export function bindAbortToRequest(request: FastifyRequest): AbortController {
  const controller = new AbortController();
  request.raw.on('close', () => {
    if (request.raw.destroyed) {
      controller.abort();
    }
  });
  return controller;
}

const SAFE_PARAM_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

export function parseCatalogType(rawType: unknown): 'tv' | 'movies' | 'series' {
  const parsed = catalogTypeSchema.safeParse(rawType);
  if (!parsed.success) {
    throw validationError('Unknown catalog type.');
  }
  return parsed.data;
}

export function parseSafeIdParam(rawValue: unknown, label: string): string {
  if (typeof rawValue !== 'string' || !SAFE_PARAM_PATTERN.test(rawValue)) {
    throw validationError(`Invalid ${label}.`);
  }
  return rawValue;
}
