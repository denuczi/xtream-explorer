import type { ConnectionStatus } from '../../types/models';
import { useI18n } from '../../i18n/useI18n';
import type { Dictionary } from '../../i18n/dictionaries';

/** Shared so the header collapse button can mirror connection state. */
export const STATUS_DOT_CLASSES: Record<ConnectionStatus, string> = {
  disconnected: 'bg-zinc-500',
  connecting: 'bg-amber-400 animate-pulse',
  connected: 'bg-emerald-400',
  error: 'bg-red-500',
};

const PILL_CLASSES: Record<ConnectionStatus, string> = {
  disconnected: 'border-line text-zinc-400',
  connecting: 'border-amber-500/40 text-amber-300',
  connected: 'border-emerald-500/40 text-emerald-300',
  error: 'border-red-500/40 text-red-300',
};

const STATUS_KEYS: Record<ConnectionStatus, keyof Dictionary['status']> = {
  disconnected: 'disconnected',
  connecting: 'connecting',
  connected: 'connected',
  error: 'error',
};

export function StatusPill({ status }: { status: ConnectionStatus }) {
  const { t } = useI18n();

  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-medium ${PILL_CLASSES[status]}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT_CLASSES[status]}`} />
      {t.status[STATUS_KEYS[status]]}
    </span>
  );
}
