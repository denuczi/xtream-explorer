import { randomUUID } from 'node:crypto';
import type { XtreamClient, ServerInfoSnapshot } from '../xtream/client';
import type { StreamFormat } from '../schemas/connection';
import type {
  CatalogType,
  Category,
  Episode,
  Movie,
  Channel,
  Season,
  SeriesDetail,
  SeriesSummary,
  VodDetail,
} from '../schemas/catalog';

export interface CatalogCache {
  categories: Map<CatalogType, Category[]>;
  streamsByCategoryKey: Map<string, Channel[] | Movie[] | SeriesSummary[]>;
  seriesInfoById: Map<string, { detail: SeriesDetail; seasons: Season[]; episodes: Episode[] }>;
  vodInfoById: Map<string, VodDetail>;
  /** Negotiated playback extension per live channel id ('m3u8' | 'ts'). */
  liveExtensionByChannel: Map<string, string>;
}

function createCatalogCache(): CatalogCache {
  return {
    categories: new Map(),
    streamsByCategoryKey: new Map(),
    seriesInfoById: new Map(),
    vodInfoById: new Map(),
    liveExtensionByChannel: new Map(),
  };
}

export interface StoredSession {
  readonly id: string;
  readonly client: XtreamClient;
  readonly streamFormat: StreamFormat;
  readonly serverInfo: ServerInfoSnapshot | null;
  readonly createdAt: Date;
  /** Session-scoped catalog cache; discarded when the session is deleted. */
  readonly catalog: CatalogCache;
}

/**
 * In-memory session registry. Credentials live only inside the XtreamClient
 * held by each entry; they are never serialized or returned to the client.
 * Sessions (and their caches) are lost on server restart by design.
 */
class SessionStore {
  private readonly sessions = new Map<string, StoredSession>();

  create(
    client: XtreamClient,
    streamFormat: StreamFormat,
    serverInfo: ServerInfoSnapshot | null,
  ): StoredSession {
    const session: StoredSession = {
      id: randomUUID(),
      client,
      streamFormat,
      serverInfo,
      createdAt: new Date(),
      catalog: createCatalogCache(),
    };
    this.sessions.set(session.id, session);
    return session;
  }

  get(id: string): StoredSession | undefined {
    return this.sessions.get(id);
  }

  delete(id: string): boolean {
    return this.sessions.delete(id);
  }

  count(): number {
    return this.sessions.size;
  }
}

export const sessionStore = new SessionStore();
