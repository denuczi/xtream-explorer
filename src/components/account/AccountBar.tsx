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
      className="flex flex-wrap gap-x-8 gap-y-4 border-y border-line py-4"
    >
      {cells.map((cell) => (
        <div key={cell.label} className="min-w-[120px] flex-1">
          <p className="text-[11px] font-medium text-white/56">{cell.label}</p>
          <p className="mt-1 text-[13px] font-medium leading-none text-white">{cell.value}</p>
        </div>
      ))}

      <div className="min-w-[120px] flex-1">
        <p className="text-[11px] font-medium text-white/56">{t.account.status}</p>
        <p
          className={`mt-1 inline-flex items-center gap-1.5 text-[13px] font-medium leading-none ${
            !isStatusKnown ? 'text-white' : isActive ? 'text-emerald-400' : 'text-amber-400'
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
