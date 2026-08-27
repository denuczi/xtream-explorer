import { lazy, Suspense, useState } from 'react';
import { PlugZap } from 'lucide-react';
import { I18nProvider } from '../i18n/I18nProvider';
import { useI18n } from '../i18n/useI18n';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { ConnectionBar } from '../components/connection/ConnectionBar';
import { AccountBar } from '../components/account/AccountBar';
import { NavigationTabs, type CatalogTab } from '../components/navigation/NavigationTabs';
import { useConnectionStore } from '../stores/connection-store';
import { PlaylistDownloadButton } from '../components/navigation/PlaylistDownloadButton';
import { ScrollToTopButton } from '../components/navigation/ScrollToTopButton';

// Route-level code splitting: each tab and the player are loaded on demand.
const TvPage = lazy(() => import('../features/tv/TvPage').then((m) => ({ default: m.TvPage })));
const MoviesPage = lazy(() =>
  import('../features/movies/MoviesPage').then((m) => ({ default: m.MoviesPage })),
);
const SeriesPage = lazy(() =>
  import('../features/series/SeriesPage').then((m) => ({ default: m.SeriesPage })),
);
const PlayerModal = lazy(() =>
  import('../components/player/PlayerModal').then((m) => ({ default: m.PlayerModal })),
);

function ConnectPrompt() {
  const { t } = useI18n();

  return (
    <section className="flex min-h-[46vh] items-center justify-center rounded-[12px] border border-line bg-surface">
      <div className="max-w-sm px-8 py-12 text-center">
        <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-white/[0.06] border border-line">
          <PlugZap className="h-5 w-5 text-white/40" aria-hidden />
        </span>
        <p className="mt-4 text-[13px] leading-relaxed text-white/56">{t.catalog.connectFirst}</p>
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

      <main className="mx-auto max-w-[1280px] space-y-8 px-6 py-8 lg:px-10">
        {account !== null && <AccountBar account={account} />}

        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-5">
          <NavigationTabs active={activeTab} onChange={setActiveTab} />
          {isConnected && <PlaylistDownloadButton connectionId={connectionId} type={activeTab} />}
        </div>

        {!isConnected ? (
          <ConnectPrompt />
        ) : (
          <Suspense
            fallback={
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
                {Array.from({ length: 12 }).map((_, index) => (
                  <div
                    key={index}
                    className="aspect-[2/3] animate-pulse rounded-[10px] bg-surface"
                  />
                ))}
              </div>
            }
          >
            {activeTab === 'tv' && <TvPage connectionId={connectionId} />}
            {activeTab === 'movies' && <MoviesPage connectionId={connectionId} />}
            {activeTab === 'series' && <SeriesPage connectionId={connectionId} />}
          </Suspense>
        )}
      </main>

      <Suspense fallback={null}>
        <PlayerModal />
      </Suspense>
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
