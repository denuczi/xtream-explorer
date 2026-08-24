import { z } from 'zod';

export const streamFormatSchema = z.enum(['ts', 'm3u8']);
export type StreamFormat = z.infer<typeof streamFormatSchema>;

export const connectionRequestSchema = z.object({
  server: z.string().min(1).max(2048),
  username: z.string().min(1).max(128),
  password: z.string().min(1).max(256),
  streamFormat: streamFormatSchema,
  /** Per-connection opt-in for panels with broken TLS chains (UI toggle). */
  allowInsecureTls: z.boolean().optional().default(false),
});

export type ConnectionRequestBody = z.infer<typeof connectionRequestSchema>;

/** Response contract for POST /api/connection (never includes credentials). */
export interface ConnectionResponse {
  connectionId: string;
  account: AccountResponse;
}

export interface AccountResponse {
  status: string | null;
  createdAt: string | null;
  expiresAt: string | null;
  maxConnections: number | null;
  activeConnections: number | null;
}

export const CONNECTION_ID_HEADER = 'x-connection-id';

export function readConnectionIdHeader(value: unknown): string | null {
  if (typeof value === 'string' && value.trim().length > 0) return value.trim();
  if (Array.isArray(value)) {
    const first = value[0];
    if (typeof first === 'string' && first.trim().length > 0) return first.trim();
  }
  return null;
}
