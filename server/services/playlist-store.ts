import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { streamFormatSchema } from '../schemas/connection';

/**
 * Saved playlists live ONLY in this server-side JSON file. Passwords never
 * travel back to the browser: the API exposes every field except `password`,
 * and reconnecting happens by playlist id.
 */
const dataDir = process.env.PLAYLISTS_DATA_DIR ?? join(fileURLToPath(import.meta.url), '..', '..', '.data');
const dataFile = join(dataDir, 'saved-playlists.json');

const storedPlaylistSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  server: z.string().min(1),
  username: z.string().min(1),
  password: z.string().min(1),
  streamFormat: streamFormatSchema,
  allowInsecureTls: z.boolean(),
  createdAt: z.string(),
  lastUsedAt: z.string(),
});

export type StoredPlaylist = z.infer<typeof storedPlaylistSchema>;
export type PublicPlaylist = Omit<StoredPlaylist, 'password'>;

export interface PlaylistUpsertInput {
  server: string;
  username: string;
  password: string;
  streamFormat: z.infer<typeof streamFormatSchema>;
  allowInsecureTls: boolean;
}

function nowIso(): string {
  return new Date().toISOString();
}

function labelFromServer(server: string): string {
  try {
    return new URL(server).host;
  } catch {
    return server;
  }
}

class PlaylistStore {
  private entries: StoredPlaylist[] = [];
  private loaded = false;

  async load(): Promise<void> {
    if (this.loaded) return;
    try {
      const raw = await readFile(dataFile, 'utf8');
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        // Legacy migration: 'm3u' was renamed to 'm3u8' (HLS standard).
        // Then corrupt or outdated records are skipped, not fatal.
        const migrated = parsed.map((item) =>
          typeof item === 'object' && item !== null &&
          (item as Record<string, unknown>).streamFormat === 'm3u'
            ? { ...(item as Record<string, unknown>), streamFormat: 'm3u8' }
            : item,
        );
        this.entries = migrated.flatMap((entry) => {
          const result = storedPlaylistSchema.safeParse(entry);
          return result.success ? [result.data] : [];
        });
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException | null)?.code !== 'ENOENT') {
        console.warn('[playlists] could not read store:', (error as Error).message);
      }
    }
    this.loaded = true;
  }

  private async persist(): Promise<void> {
    await mkdir(dataDir, { recursive: true });
    const tmpFile = `${dataFile}.tmp`;
    await writeFile(tmpFile, JSON.stringify(this.entries, null, 2), 'utf8');
    await rename(tmpFile, dataFile); // atomic swap
  }

  listPublic(): PublicPlaylist[] {
    return [...this.entries]
      .sort((a, b) => b.lastUsedAt.localeCompare(a.lastUsedAt))
      .map(({ password: _password, ...publicPart }) => publicPart);
  }

  get(id: string): StoredPlaylist | undefined {
    return this.entries.find((entry) => entry.id === id);
  }

  /** Creates or refreshes the entry matching server+username. */
  async upsert(input: PlaylistUpsertInput): Promise<PublicPlaylist> {
    await this.load();
    const existing = this.entries.find(
      (entry) => entry.server === input.server && entry.username === input.username,
    );

    let saved: StoredPlaylist;
    if (existing !== undefined) {
      existing.password = input.password;
      existing.streamFormat = input.streamFormat;
      existing.allowInsecureTls = input.allowInsecureTls;
      existing.lastUsedAt = nowIso();
      saved = existing;
    } else {
      saved = {
        id: randomUUID(),
        label: labelFromServer(input.server),
        createdAt: nowIso(),
        lastUsedAt: nowIso(),
        ...input,
      };
      this.entries.push(saved);
    }

    await this.persist();
    const { password: _password, ...publicPart } = saved;
    return publicPart;
  }

  async touch(id: string): Promise<void> {
    const entry = this.get(id);
    if (entry === undefined) return;
    entry.lastUsedAt = nowIso();
    await this.persist();
  }

  async remove(id: string): Promise<boolean> {
    await this.load();
    const before = this.entries.length;
    this.entries = this.entries.filter((entry) => entry.id !== id);
    if (this.entries.length === before) return false;
    await this.persist();
    return true;
  }
}

export const playlistStore = new PlaylistStore();
