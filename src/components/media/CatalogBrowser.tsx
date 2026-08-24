import { useCallback, useEffect, useMemo, useState } from 'react';
import { Search, X } from 'lucide-react';
import { useCatalogStore } from '../../stores/catalog-store';
import { usePlayerStore } from '../../stores/player-store';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { useI18n } from '../../i18n/useI18n';
import { interpolate } from '../../i18n/dictionaries';
import type { CatalogItem, CatalogType, SeriesSummary } from '../../types/models';
import { normalizeForSearch } from '../../lib/text';
import { CategoryRail } from '../navigation/CategoryRail';
import { MediaCard, type CardVariant } from './MediaCard';
import { EmptyState, ErrorState, GridSkeleton } from './StatusViews';

const MAX_SEARCH_RESULTS = 300;
const MIN_QUERY_LENGTH = 2;

interface CatalogBrowserProps {
  type: CatalogType;
  variant: CardVariant;
  connectionId: string;
  onSelectSeries?: (series: SeriesSummary) => void;
}

interface CardProps {
  key: string;
  title: string;
  imageUrl: string | null;
  subtitle: string | null;
  badge: string | null;
  onClick?: () => void;
}

interface OpenPlayerFn {
  (kind: 'channel' | 'movie', id: string, name: string): void;
}

function cardPropsFor(
  item: CatalogItem,
  variant: CardVariant,
  onSelectSeries: ((series: SeriesSummary) => void) | undefined,
  onOpenPlayer: OpenPlayerFn | undefined,
): CardProps {
  if ('epgId' in item) {
    // Channel → plays immediately
    return {
      key: `tv-${item.id}`,
      title: item.name,
      imageUrl: item.logo,
      subtitle: item.number === null ? null : `#${item.number}`,
      badge: null,
      onClick: onOpenPlayer === undefined ? undefined : () => onOpenPlayer('channel', item.id, item.name),
    };
  }
  if ('cover' in item) {
    // Series summary → drill-down detail
    return {
      key: `series-${item.id}`,
      title: item.name,
      imageUrl: item.cover,
      subtitle: item.genre,
      badge: null,
      onClick: onSelectSeries === undefined ? undefined : () => onSelectSeries(item),
    };
  }
  // Movie → plays immediately
  return {
    key: `movie-${item.id}`,
    title: item.name,
    imageUrl: item.logo,
    subtitle: null,
    badge: variant === 'poster' ? item.rating : null,
    onClick: onOpenPlayer === undefined ? undefined : () => onOpenPlayer('movie', item.id, item.name),
  };
}

export function CatalogBrowser({ type, variant, connectionId, onSelectSeries }: CatalogBrowserProps) {
  const { t } = useI18n();
  const [rawQuery, setRawQuery] = useState('');
  const debouncedQuery = useDebouncedValue(rawQuery.trim(), 250);
  const query = normalizeForSearch(debouncedQuery);
  const isSearchMode = query.length >= MIN_QUERY_LENGTH;

  const openPlayer = usePlayerStore((state) => state.open);
  const categories = useCatalogStore((state) => state.categories[type]);
  const activeId = useCatalogStore((state) => state.activeCategoryId[type]);
  const selectCategory = useCatalogStore((state) => state.selectCategory);
  const ensureStreams = useCatalogStore((state) => state.ensureStreams);
  const ensureAllStreams = useCatalogStore((state) => state.ensureAllStreams);
  const allEntry = useCatalogStore((state) => state.streams[`${type}:all`]);
  const streamsEntry = useCatalogStore((state) =>
    activeId === null ? undefined : state.streams[`${type}:${activeId}`],
  );

  // Fetch the full catalog once per session when search activates.
  useEffect(() => {
    if (isSearchMode) {
      void ensureAllStreams(type);
    }
  }, [isSearchMode, type, ensureAllStreams]);

  const results = useMemo(() => {
    if (!isSearchMode || allEntry?.status !== 'success' || allEntry.data === null) return [];
    return allEntry.data.filter((item) => normalizeForSearch(item.name).includes(query));
  }, [isSearchMode, allEntry, query]);

  const totalMatches = results.length;
  const visibleResults = useMemo(() => results.slice(0, MAX_SEARCH_RESULTS), [results]);

  const handleSelectCategory = useCallback(
    (categoryId: string) => {
      setRawQuery('');
      selectCategory(type, categoryId);
    },
    [type, selectCategory],
  );

  const handleOpenPlayer = useCallback<OpenPlayerFn>(
    (kind, id, name) => {
      openPlayer({ kind, catalogType: type, id, name });
    },
    [openPlayer, type],
  );

  // Auto-select the first category once its list arrives.
  useEffect(() => {
    if (categories.status === 'success' && activeId === null && (categories.data?.length ?? 0) > 0) {
      const first = categories.data?.[0];
      if (first !== undefined) {
        selectCategory(type, first.id);
      }
    }
  }, [categories, activeId, type, selectCategory]);

  const searchPlaceholder =
    type === 'tv'
      ? t.catalog.searchChannels
      : type === 'movies'
        ? t.catalog.searchMovies
        : t.catalog.searchSeries;

  return (
    <div className="space-y-4">
      {/* Content search — scoped to the active tab */}
      <div className="relative max-w-xl">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" aria-hidden />
        <input
          type="text"
          enterKeyHint="search"
          autoComplete="off"
          value={rawQuery}
          onChange={(event) => setRawQuery(event.target.value)}
          placeholder={searchPlaceholder}
          aria-label={searchPlaceholder}
          className="w-full rounded-lg border border-line bg-surface py-2.5 pl-9 pr-9 text-sm text-zinc-100 placeholder:text-zinc-500 outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/30"
        />
        {rawQuery.length > 0 && (
          <button
            type="button"
            aria-label={t.catalog.clearSearch}
            onClick={() => setRawQuery('')}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-zinc-500 transition hover:bg-surface-raised hover:text-zinc-200"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        )}
      </div>

      <div className="flex flex-col gap-5 lg:flex-row">
        <CategoryRail
          type={type}
          connectionId={connectionId}
          onSelectCategory={handleSelectCategory}
        />

        <section className="min-w-0 flex-1" aria-live="polite">
          {isSearchMode ? (
            <>
              {allEntry?.status === 'loading' && <GridSkeleton variant={variant} />}

              {allEntry?.status === 'error' && (
                <ErrorState onRetry={() => void ensureAllStreams(type)} />
              )}

              {allEntry?.status === 'success' && (
                totalMatches === 0 ? (
                  <div className="flex items-center justify-center rounded-xl border border-dashed border-line bg-surface/40 px-6 py-14 text-center">
                    <p className="text-sm text-zinc-500">
                      {t.catalog.noResults} <span className="font-semibold text-zinc-300">“{debouncedQuery}”</span>
                    </p>
                  </div>
                ) : (
                  <>
                    <p className="mb-3 text-xs font-medium uppercase tracking-wide text-zinc-500">
                      {interpolate(t.catalog.resultsCount, { count: totalMatches })}
                      {totalMatches > MAX_SEARCH_RESULTS ? ` · ${t.catalog.truncatedNote}` : ''}
                    </p>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
                      {visibleResults.map((item) => {
                        const { key, ...cardProps } = cardPropsFor(item, variant, onSelectSeries, handleOpenPlayer);
                        return <MediaCard key={key} variant={variant} {...cardProps} />;
                      })}
                    </div>
                  </>
                )
              )}
            </>
          ) : (
            <>
              {streamsEntry?.status === 'loading' && <GridSkeleton variant={variant} />}

              {streamsEntry?.status === 'error' && (
                <ErrorState onRetry={() => activeId !== null && void ensureStreams(type, activeId)} />
              )}

              {streamsEntry?.status === 'success' && streamsEntry.data !== null && (
                streamsEntry.data.length === 0 ? (
                  <EmptyState />
                ) : (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
                    {streamsEntry.data.map((item) => {
                      const { key, ...cardProps } = cardPropsFor(item, variant, onSelectSeries, handleOpenPlayer);
                      return <MediaCard key={key} variant={variant} {...cardProps} />;
                    })}
                  </div>
                )
              )}

              {(streamsEntry === undefined || streamsEntry.status === 'idle') && (
                <GridSkeleton variant={variant} />
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
