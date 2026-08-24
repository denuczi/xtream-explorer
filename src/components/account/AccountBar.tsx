import { useI18n } from '../../i18n/useI18n';
import type { AccountInfo } from '../../types/models';

function formatDate(iso: string | null, locale: string, fallback: string): string {
  if (iso === null) return fallback;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return fallback;
  return new Intl.DateTimeFormat(locale === 'es' ? 'es-ES' : 'en-US', {
    dateStyle: 'medium',
  }).format(date);
}

export function AccountBar({ account }: { account: AccountInfo }) {
  const { t, locale } = useI18n();
  const notAvailable = t.account.notAvailable;

  const connections =
    account.activeConnections === null && account.maxConnections === null
      ? notAvailable
      : `${account.activeConnections ?? notAvailable} / ${account.maxConnections ?? notAvailable}`;

  const status = account.status;
  const isStatusKnown = status !== null;
  const isActive = status?.toLowerCase() === 'active';

  const cells = [
    { label: t.account.createdAt, value: formatDate(account.createdAt, locale, notAvailable) },
    { label: t.account.expiresAt, value: formatDate(account.expiresAt, locale, notAvailable) },
    { label: t.account.connections, value: connections },
  ];

  return (
    <section
      aria-label={t.appName}
      className="grid grid-cols-2 gap-3 rounded-xl border border-line bg-surface p-4 sm:grid-cols-4"
    >
      {cells.map((cell) => (
        <div key={cell.label}>
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">{cell.label}</p>
          <p className="mt-1 text-sm font-semibold text-zinc-100">{cell.value}</p>
        </div>
      ))}

      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">{t.account.status}</p>
        <p
          className={`mt-1 inline-flex items-center gap-1.5 text-sm font-semibold ${
            !isStatusKnown ? 'text-zinc-100' : isActive ? 'text-emerald-400' : 'text-amber-400'
          }`}
        >
          {!isStatusKnown ? (
            notAvailable
          ) : (
            <>
              <span
                className={`h-1.5 w-1.5 rounded-full ${isActive ? 'bg-emerald-400' : 'bg-amber-400'}`}
                aria-hidden
              />
              {status}
            </>
          )}
        </p>
      </div>
    </section>
  );
}
