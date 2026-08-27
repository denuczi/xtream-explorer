import { useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { useI18n } from '../../i18n/useI18n';
import { downloadPlaylist } from '../../lib/api';
import { useConnectionStore } from '../../stores/connection-store';
import type { CatalogType } from '../../types/models';
import { ExportOptionsModal } from './ExportOptionsModal';

interface PlaylistDownloadButtonProps {
  connectionId: string;
  type: CatalogType;
}

/**
 * Per-tab export entry point. Series JSON has no configurable options, so it
 * downloads immediately; TV/Movies open the options modal first.
 */
export function PlaylistDownloadButton({ connectionId, type }: PlaylistDownloadButtonProps) {
  const { t } = useI18n();
  const [modalOpen, setModalOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function downloadDirect(): Promise<void> {
    if (busy) return;
    setFailed(false);
    setBusy(true);
    try {
      await downloadPlaylist(connectionId, type);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  function handleClick(): void {
    if (busy) return;
    setFailed(false);
    // Series JSON carries no playback URLs → nothing to configure.
    if (type === 'series') {
      void downloadDirect();
      return;
    }
    setModalOpen(true);
  }

  const hint = type === 'series' ? 'JSON' : 'M3U';

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={busy}
        title={`${t.catalog.downloadPlaylist} (${hint})`}
        aria-label={`${t.catalog.downloadPlaylist} (${hint})`}
        className="inline-flex items-center gap-2 rounded-[10px] border border-line bg-surface px-3 py-2 text-xs font-medium text-white transition hover:bg-hover disabled:cursor-not-allowed disabled:opacity-60"
      >
        {busy ? (
          <Loader2 className="h-4 w-4 animate-spin text-white/60" aria-hidden />
        ) : (
          <Download className="h-4 w-4" aria-hidden />
        )}
        <span className="hidden sm:inline">
          {busy ? t.catalog.preparingDownload : t.catalog.downloadPlaylist}
        </span>
        <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-white/70">
          {hint}
        </span>
      </button>
      {failed && (
        <span role="alert" className="text-[11px] text-red-400">
          {t.catalog.downloadFailed}
        </span>
      )}

      {modalOpen && (
        <ExportOptionsModal
          connectionId={useConnectionStore.getState().connectionId ?? ''}
          type={type}
          onClose={() => setModalOpen(false)}
        />
      )}
    </div>
  );
}
