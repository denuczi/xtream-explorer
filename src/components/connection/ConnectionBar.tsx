import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ListVideo, X } from 'lucide-react';
import { ChevronDown, ChevronUp, Loader2, LogOut, MonitorPlay, PlugZap, ShieldOff } from 'lucide-react';
import { useI18n } from '../../i18n/useI18n';
import { useConnectionStore } from '../../stores/connection-store';
import { useCatalogStore } from '../../stores/catalog-store';
import type { StreamFormat } from '../../types/models';
import { STATUS_DOT_CLASSES, StatusPill } from './StatusPill';
import { LanguageSwitcher } from '../navigation/LanguageSwitcher';
import { usePlaylistsStore } from '../../stores/playlists-store';
import { parsePlaylistUrl } from '../../lib/playlist-url';

const LABEL_CLASS = 'mb-1 block text-xs font-medium uppercase tracking-wide text-zinc-400';

const INPUT_CLASS =
  'w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-zinc-100 ' +
  'placeholder:text-zinc-500 outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/30';

export function ConnectionBar() {
  const { t } = useI18n();
  // Fine-grained selectors: avoid re-renders on unrelated store changes.
  const status = useConnectionStore((state) => state.status);
  const errorCode = useConnectionStore((state) => state.errorCode);
  const connect = useConnectionStore((state) => state.connect);
  const connectSaved = useConnectionStore((state) => state.connectSaved);
  const disconnect = useConnectionStore((state) => state.disconnect);
  const lastPlaylistId = useConnectionStore((state) => state.lastPlaylistId);
  const playlists = usePlaylistsStore((state) => state.items);
  const refreshPlaylists = usePlaylistsStore((state) => state.refresh);
  const removePlaylist = usePlaylistsStore((state) => state.remove);

  const [server, setServer] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [streamFormat, setStreamFormat] = useState<StreamFormat>('ts');
  const [allowInsecureTls, setAllowInsecureTls] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [playlistDetected, setPlaylistDetected] = useState(false);
  const [panelCollapsed, setPanelCollapsed] = useState(false);

  // Saved playlists: initial load + refresh after every successful connect
  // (the backend auto-upserts on success).
  useEffect(() => {
    void refreshPlaylists();
  }, [refreshPlaylists, status]);

  // Clear credentials whenever we land back on "disconnected" (manual
  // disconnect or a session that died server-side). Preferences (format,
  // TLS checkbox) survive so reconnecting is quick.
  const previousStatus = useRef(status);
  useEffect(() => {
    if (previousStatus.current !== 'disconnected' && status === 'disconnected') {
      setServer('');
      setUsername('');
      setPassword('');
      setFormOpen(false);
      setPlaylistDetected(false);
    }
    previousStatus.current = status;
  }, [status]);

  const isBusy = status === 'connecting';
  const canDisconnect = status === 'connected' || status === 'error';
  const isTlsError = status === 'error' && errorCode === 'TLS_ERROR';

  function handleServerChange(value: string): void {
    const parsed = parsePlaylistUrl(value);
    if (parsed === null) {
      if (playlistDetected) setPlaylistDetected(false);
      setServer(value);
      return;
    }
    // Full playlist URL pasted: split it into the form fields.
    setServer(parsed.baseUrl);
    setUsername(parsed.username);
    setPassword(parsed.password);
    if (parsed.outputFormat !== null) {
      setStreamFormat(parsed.outputFormat);
    }
    setPlaylistDetected(true);
  }

  function handleConnectSaved(playlistId: string): void {
    if (isBusy) return;
    useCatalogStore.getState().resetCatalog();
    void connectSaved(playlistId).then(() => refreshPlaylists());
  }

  function handleDeletePlaylist(event: React.MouseEvent, playlistId: string): void {
    event.stopPropagation();
    if (isBusy) return;
    void removePlaylist(playlistId).then(() => refreshPlaylists());
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isBusy) return;
    useCatalogStore.getState().resetCatalog();
    void connect({ server, username, password, streamFormat, allowInsecureTls });
  }

  function handleTlsRetry() {
    if (isBusy) return;
    setAllowInsecureTls(true);
    useCatalogStore.getState().resetCatalog();
    void connect({ server, username, password, streamFormat, allowInsecureTls: true });
  }

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-app/90 backdrop-blur supports-[backdrop-filter]:bg-app/75">
      <div
        id="connection-panel"
        aria-hidden={panelCollapsed}
        inert={panelCollapsed}
        className={`grid transition-[grid-template-rows] duration-300 ease-in-out ${
          panelCollapsed ? 'grid-rows-[0fr]' : 'grid-rows-[1fr]'
        }`}
      >
        <div className="overflow-hidden">
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3">
        <MonitorPlay className="h-6 w-6 shrink-0 text-accent" aria-hidden />
        <span className="truncate text-sm font-semibold tracking-tight text-zinc-100 sm:text-base">
          {t.appName}
        </span>

        <div className="ml-auto flex items-center gap-2">
          <LanguageSwitcher />
          <span className="hidden sm:inline-flex">
            <StatusPill status={status} />
          </span>
          <button
            type="button"
            aria-expanded={formOpen}
            aria-label={formOpen ? t.connection.hideForm : t.connection.showForm}
            onClick={() => setFormOpen((open) => !open)}
            className="rounded-lg border border-line bg-surface p-2 text-zinc-300 transition hover:text-zinc-100 md:hidden"
          >
            <ChevronDown
              className={`h-4 w-4 transition-transform ${formOpen ? 'rotate-180' : ''}`}
              aria-hidden
            />
          </button>
        </div>
      </div>

      <div className={`${formOpen ? 'block' : 'hidden'} border-t border-line md:block`}>
        <form
          onSubmit={handleSubmit}
          className="mx-auto grid max-w-7xl grid-cols-1 items-end gap-3 px-4 py-3 sm:grid-cols-2 lg:grid-cols-[minmax(240px,2fr)_minmax(140px,1fr)_minmax(140px,1fr)_120px_auto_auto_auto]"
        >
          <div>
            <label htmlFor="xtream-server" className={LABEL_CLASS}>
              {t.connection.server}
            </label>
            <input
              id="xtream-server"
              type="text"
              inputMode="url"
              autoComplete="off"
              spellCheck={false}
              placeholder={t.connection.serverPlaceholder}
              value={server}
              onChange={(event) => handleServerChange(event.target.value)}
              disabled={isBusy}
              className={INPUT_CLASS}
            />
            {playlistDetected && (
              <p className="mt-1 text-[11px] font-medium text-amber-400/90">
                {t.connection.playlistDetected}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="xtream-username" className={LABEL_CLASS}>
              {t.connection.username}
            </label>
            <input
              id="xtream-username"
              type="text"
              autoComplete="off"
              spellCheck={false}
              placeholder={t.connection.usernamePlaceholder}
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              disabled={isBusy}
              className={INPUT_CLASS}
            />
          </div>

          <div>
            <label htmlFor="xtream-password" className={LABEL_CLASS}>
              {t.connection.password}
            </label>
            <input
              id="xtream-password"
              type="password"
              autoComplete="new-password"
              placeholder={t.connection.passwordPlaceholder}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              disabled={isBusy}
              className={INPUT_CLASS}
            />
          </div>

          <div>
            <label htmlFor="xtream-format" className={LABEL_CLASS}>
              {t.connection.streamFormat}
            </label>
            <select
              id="xtream-format"
              value={streamFormat}
              onChange={(event) => setStreamFormat(event.target.value as StreamFormat)}
              disabled={isBusy}
              className={INPUT_CLASS}
            >
              <option value="ts">{t.connection.formatTs}</option>
              <option value="m3u8">{t.connection.formatM3u8}</option>
            </select>
          </div>

          <div className="flex items-end pb-2.5">
            <label
              htmlFor="xtream-insecure-tls"
              title={t.connection.insecureTlsHint}
              className="flex cursor-pointer items-center gap-2 text-xs font-medium text-zinc-400 transition hover:text-zinc-200"
            >
              <input
                id="xtream-insecure-tls"
                type="checkbox"
                checked={allowInsecureTls}
                onChange={(event) => setAllowInsecureTls(event.target.checked)}
                disabled={isBusy}
                className="h-4 w-4 shrink-0 cursor-pointer rounded border-line bg-surface accent-[var(--color-accent)]"
              />
              <span className="hidden xl:inline">{t.connection.insecureTlsLabel}</span>
              <ShieldOff className="h-4 w-4 xl:hidden" aria-hidden />
            </label>
          </div>

          <button
            type="submit"
            disabled={isBusy}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-accent px-4 text-sm font-semibold text-white transition hover:bg-accent/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isBusy ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                {t.connection.connecting}
              </>
            ) : (
              <>
                <PlugZap className="h-4 w-4" aria-hidden />
                {t.connection.connect}
              </>
            )}
          </button>

          {canDisconnect && (
            <button
              type="button"
              onClick={() => {
                useCatalogStore.getState().resetCatalog();
                void disconnect();
              }}
              disabled={isBusy}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-line bg-surface px-4 text-sm font-medium text-zinc-200 transition hover:bg-surface-raised focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-60"
            >
              <LogOut className="h-4 w-4" aria-hidden />
              {t.connection.disconnect}
            </button>
          )}
        </form>

        {playlists.length > 0 && (
          <div className="mx-auto max-w-7xl px-4 pb-3">
            <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-zinc-500">
              <ListVideo className="h-3.5 w-3.5" aria-hidden />
              {t.playlists.title}
            </p>
            <div className="scroll-slim flex gap-2 overflow-x-auto pb-1">
              {playlists.map((playlist) => {
                const isActive = lastPlaylistId === playlist.id && status === 'connected';
                return (
                  <span
                    key={playlist.id}
                    className={`group inline-flex shrink-0 items-center overflow-hidden rounded-full border text-xs transition ${
                      isActive
                        ? 'border-accent bg-accent/15 text-zinc-100'
                        : 'border-line bg-surface text-zinc-300'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => handleConnectSaved(playlist.id)}
                      disabled={isBusy}
                      title={`${playlist.server} · ${playlist.username}`}
                      className="inline-flex items-center gap-1.5 py-1.5 pl-3 pr-1.5 font-medium transition hover:bg-surface-raised disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isActive && <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" aria-hidden />}
                      {playlist.label}
                    </button>
                    <button
                      type="button"
                      aria-label={t.playlists.deleteLabel}
                      onClick={(event) => handleDeletePlaylist(event, playlist.id)}
                      className="mr-1.5 rounded-full p-1 text-zinc-500 transition hover:bg-red-500/15 hover:text-red-300"
                    >
                      <X className="h-3 w-3" aria-hidden />
                    </button>
                  </span>
                );
              })}
            </div>
          </div>
        )}

        {status === 'error' && errorCode !== null && (
          <div className="mx-auto max-w-7xl px-4 pb-3">
            <p
              role="alert"
              className={`flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border px-3 py-2 text-sm ${
                isTlsError
                  ? 'border-amber-500/30 bg-amber-500/10 text-amber-300'
                  : 'border-red-500/30 bg-red-500/10 text-red-300'
              }`}
            >
              <span className="min-w-0">{t.errors[errorCode] ?? t.errors.UNKNOWN}</span>
              {isTlsError && (
                <button
                  type="button"
                  onClick={handleTlsRetry}
                  disabled={isBusy}
                  className="ml-auto inline-flex items-center gap-2 rounded-lg border border-amber-400/40 bg-amber-500/15 px-3 py-1 text-xs font-semibold text-amber-200 transition hover:bg-amber-500/25 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <ShieldOff className="h-3.5 w-3.5" aria-hidden />
                  {t.connection.tlsRetryButton}
                </button>
              )}
            </p>
          </div>
        )}
        </div>
        </div>
      </div>

      {/* Full-panel collapse toggle: the status dot keeps feedback while hidden */}
      <button
        type="button"
        onClick={() => setPanelCollapsed((collapsed) => !collapsed)}
        aria-expanded={!panelCollapsed}
        aria-controls="connection-panel"
        className="mx-auto flex w-full items-center justify-center gap-2 border-t border-line py-1.5 text-[11px] font-medium text-zinc-400 transition hover:bg-surface hover:text-zinc-200 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent"
      >
        <span aria-hidden className={`h-2 w-2 rounded-full ${STATUS_DOT_CLASSES[status]}`} />
        {panelCollapsed ? (
          <>
            <ChevronDown className="h-3.5 w-3.5" aria-hidden />
            {t.connection.expandPanel}
          </>
        ) : (
          <>
            <ChevronUp className="h-3.5 w-3.5" aria-hidden />
            {t.connection.collapsePanel}
          </>
        )}
      </button>
    </header>
  );
}
