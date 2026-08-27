import type { ConnectionStatus } from '../../types/models';
import { useI18n } from '../../i18n/useI18n';
import type { Dictionary } from '../../i18n/dictionaries';
import { STATUS_DOT_CLASSES } from './status';

const PILL_CLASSES: Record<ConnectionStatus, string> = {
  disconnected: 'border-line text-white/56',
  connecting: 'border-amber-500/20 bg-amber-500/10 text-amber-200',
  connected: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-200',
  error: 'border-red-500/20 bg-red-500/10 text-red-200',
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
