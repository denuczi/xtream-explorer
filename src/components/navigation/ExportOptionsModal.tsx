import { useEffect, useState, type FormEvent } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { useI18n } from '../../i18n/useI18n';
import { ApiError, downloadPlaylist, getAppConfig } from '../../lib/api';
import type { CatalogType } from '../../types/models';
import { ModalShell } from '../ui/ModalShell';
import { interpolate } from '../../i18n/dictionaries';

interface ExportOptionsModalProps {
  connectionId: string;
  type: CatalogType;
  onClose: () => void;
}

type UaChoice = 'default' | 'none' | 'custom';

const UA_CHOICES: readonly UaChoice[] = ['default', 'none', 'custom'];

/**
 * Centered options dialog for M3U exports. Series JSON carries no playback
 * URLs, so the button never opens this dialog for that tab.
 */
export function ExportOptionsModal({ connectionId, type, onClose }: ExportOptionsModalProps) {
  const { t } = useI18n();

  const [uaChoice, setUaChoice] = useState<UaChoice>('default');
  const [customUa, setCustomUa] = useState('');
  const [defaultUa, setDefaultUa] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let stale = false;
    getAppConfig()
      .then((config) => {
        if (!stale) setDefaultUa(config.defaultUserAgent);
      })
      .catch(() => undefined); // hint only; never blocks the export
    return () => {
      stale = true;
    };
  }, []);

  const customInvalid = uaChoice === 'custom' && customUa.trim().length === 0;

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (busy || customInvalid) return;
    setFailed(false);
    setBusy(true);
    downloadPlaylist(connectionId, type, {
      uaMode: uaChoice,
      ua: uaChoice === 'custom' ? customUa.trim() : undefined,
    })
      .then(() => onClose()) // success: browser download UI is the confirmation
      .catch((error: unknown) => {
        setFailed(true);
        if (error instanceof ApiError && error.code === 'SESSION_NOT_FOUND') onClose();
      })
      .finally(() => setBusy(false));
  }

  return (
    <ModalShell onClose={onClose} ariaLabel={t.playlists.exportTitle}>
      <form onSubmit={handleSubmit} className="space-y-5 p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-zinc-100">{t.playlists.exportTitle}</h2>
            <p className="mt-0.5 text-xs text-zinc-500">
              {type === 'tv' ? t.nav.tv : t.nav.movies} · M3U8
            </p>
          </div>
        </div>

        <fieldset className="space-y-2">
          <legend className="text-xs font-medium uppercase tracking-wide text-zinc-400">
            {t.playlists.uaHeading}
          </legend>

          {UA_CHOICES.map((choice) => (
            <label
              key={choice}
              className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition ${
                uaChoice === choice
                  ? 'border-accent bg-accent/10'
                  : 'border-line bg-surface hover:bg-surface-raised'
              }`}
            >
              <input
                type="radio"
                name="ua-mode"
                value={choice}
                checked={uaChoice === choice}
                onChange={() => setUaChoice(choice)}
                className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--color-accent)]"
              />
              <span className="min-w-0">
                <span className="block text-sm font-medium text-zinc-100">
                  {choice === 'default'
                    ? t.playlists.uaOptionDefault
                    : choice === 'none'
                      ? t.playlists.uaOptionNone
                      : t.playlists.uaOptionCustom}
                </span>
                {choice === 'default' && defaultUa !== null && (
                  <span className="mt-0.5 block truncate text-[11px] text-zinc-500">
                    {interpolate(t.playlists.uaCurrentValue, { value: defaultUa })}
                  </span>
                )}
                {choice === 'none' && (
                  <span className="mt-0.5 block text-[11px] text-zinc-500">
                    {t.playlists.uaNoneHint}
                  </span>
                )}
              </span>
            </label>
          ))}

          {uaChoice === 'custom' && (
            <input
              type="text"
              value={customUa}
              onChange={(event) => setCustomUa(event.target.value)}
              placeholder={t.playlists.uaCustomPlaceholder}
              autoFocus
              maxLength={128}
              spellCheck={false}
              autoComplete="off"
              aria-invalid={customInvalid}
              className={`w-full rounded-lg border bg-surface px-3 py-2 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-500 focus:ring-2 focus:ring-accent/30 ${
                customInvalid ? 'border-red-500/60' : 'border-line focus:border-accent'
              }`}
            />
          )}
          {uaChoice === 'custom' && customInvalid && (
            <p role="alert" className="text-[11px] text-red-400">
              {t.playlists.uaCustomRequired}
            </p>
          )}
        </fieldset>

        {failed && (
          <p role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
            {t.catalog.downloadFailed}
          </p>
        )}

        <div className="flex items-center justify-end gap-2 border-t border-line pt-4">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-lg border border-line bg-surface px-4 py-2 text-sm font-medium text-zinc-200 transition hover:bg-surface-raised focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-60"
          >
            {t.common.cancel}
          </button>
          <button
            type="submit"
            disabled={busy || customInvalid}
            className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:bg-accent/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                {t.catalog.preparingDownload}
              </>
            ) : (
              <>
                <Download className="h-4 w-4" aria-hidden />
                {t.catalog.downloadPlaylist}
              </>
            )}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

