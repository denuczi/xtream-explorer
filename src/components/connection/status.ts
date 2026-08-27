import type { ConnectionStatus } from '../../types/models';

export const STATUS_DOT_CLASSES: Record<ConnectionStatus, string> = {
  disconnected: 'bg-white/40',
  connecting: 'bg-amber-400 animate-pulse',
  connected: 'bg-emerald-400',
  error: 'bg-red-500',
};
