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
      <form onSubmit={handleSubmit} className="space-y-5 p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-[15px] font-semibold tracking-tight text-white">
              {t.playlists.exportTitle}
            </h2>
            <p className="mt-0.5 text-[11px] text-white/46">
              {type === 'tv' ? t.nav.tv : t.nav.movies} · M3U8
            </p>
          </div>
        </div>

        <fieldset className="space-y-2">
          <legend className="text-[11px] font-medium text-white/56">{t.playlists.uaHeading}</legend>

          {UA_CHOICES.map((choice) => (
            <label
              key={choice}
              className={`flex cursor-pointer items-start gap-3 rounded-[10px] border p-3 transition ${
                uaChoice === choice
                  ? 'border-white bg-white text-app'
                  : 'border-line bg-surface hover:bg-hover'
              }`}
            >
              <input
                type="radio"
                name="ua-mode"
                value={choice}
                checked={uaChoice === choice}
                onChange={() => setUaChoice(choice)}
                className="mt-0.5 h-4 w-4 shrink-0 accent-white"
              />
              <span className="min-w-0">
                <span
                  className={`block text-[13px] font-medium ${uaChoice === choice ? 'text-app' : 'text-white'}`}
                >
                  {choice === 'default'
                    ? t.playlists.uaOptionDefault
                    : choice === 'none'
                      ? t.playlists.uaOptionNone
                      : t.playlists.uaOptionCustom}
                </span>
                {choice === 'default' && defaultUa !== null && (
                  <span
                    className={`mt-0.5 block truncate text-[11px] ${uaChoice === choice ? 'text-app/60' : 'text-white/46'}`}
                  >
                    {interpolate(t.playlists.uaCurrentValue, { value: defaultUa })}
                  </span>
                )}
                {choice === 'none' && (
                  <span
                    className={`mt-0.5 block text-[11px] ${uaChoice === choice ? 'text-app/60' : 'text-white/46'}`}
                  >
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
              className={`w-full rounded-[10px] border bg-surface px-3 py-2 text-[13px] text-white outline-none transition placeholder:text-white/30 focus:ring-2 focus:ring-white/10 ${
                customInvalid ? 'border-red-500/60' : 'border-line focus:border-white/20'
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
          <p
            role="alert"
            className="rounded-[10px] border border-red-500/20 bg-red-500/10 px-3 py-2 text-[13px] text-red-200"
          >
            {t.catalog.downloadFailed}
          </p>
        )}

        <div className="flex items-center justify-end gap-2 border-t border-line pt-4">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-[10px] border border-line bg-surface px-4 py-2 text-[13px] font-medium text-white transition hover:bg-hover disabled:cursor-not-allowed disabled:opacity-60"
          >
            {t.common.cancel}
          </button>
          <button
            type="submit"
            disabled={busy || customInvalid}
            className="inline-flex items-center gap-2 rounded-[10px] bg-white px-4 py-2 text-[13px] font-semibold text-app transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-60"
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
