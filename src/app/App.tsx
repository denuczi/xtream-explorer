import { useState } from 'react';
import { PlugZap } from 'lucide-react';
import { I18nProvider } from '../i18n/I18nProvider';
import { useI18n } from '../i18n/useI18n';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { ConnectionBar } from '../components/connection/ConnectionBar';
import { AccountBar } from '../components/account/AccountBar';
import { NavigationTabs, type CatalogTab } from '../components/navigation/NavigationTabs';
import { useConnectionStore } from '../stores/connection-store';
import { TvPage } from '../features/tv/TvPage';
import { MoviesPage } from '../features/movies/MoviesPage';
import { SeriesPage } from '../features/series/SeriesPage';
import { PlayerModal } from '../components/player/PlayerModal';
import { PlaylistDownloadButton } from '../components/navigation/PlaylistDownloadButton';
import { ScrollToTopButton } from '../components/navigation/ScrollToTopButton';

function ConnectPrompt() {
  const { t } = useI18n();

  return (
    <section className="flex min-h-[50vh] items-center justify-center rounded-xl border border-dashed border-line bg-surface/40">
      <div className="max-w-sm px-6 py-10 text-center">
        <PlugZap className="mx-auto h-10 w-10 text-zinc-600" aria-hidden />
        <p className="mt-4 text-sm text-zinc-400">{t.catalog.connectFirst}</p>
      </div>
    </section>
  );
}

function Shell() {
  const [activeTab, setActiveTab] = useState<CatalogTab>('tv');
  const status = useConnectionStore((state) => state.status);
  const connectionId = useConnectionStore((state) => state.connectionId);
  const account = useConnectionStore((state) => state.account);
  const isConnected = status === 'connected' && connectionId !== null;

  return (
    <div className="min-h-dvh">
      <ConnectionBar />

      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6">
        {account !== null && <AccountBar account={account} />}

        <div className="flex flex-wrap items-center justify-between gap-2">
          <NavigationTabs active={activeTab} onChange={setActiveTab} />
          {isConnected && (
            <PlaylistDownloadButton connectionId={connectionId} type={activeTab} />
          )}
        </div>

        {!isConnected ? (
          <ConnectPrompt />
        ) : (
          <>
            {activeTab === 'tv' && <TvPage connectionId={connectionId} />}
            {activeTab === 'movies' && <MoviesPage connectionId={connectionId} />}
            {activeTab === 'series' && <SeriesPage connectionId={connectionId} />}
          </>
        )}
      </main>

      <PlayerModal />
      <ScrollToTopButton />
    </div>
  );
}

export default function App() {
  return (
    <I18nProvider>
      <ErrorBoundary>
        <Shell />
      </ErrorBoundary>
    </I18nProvider>
  );
}
