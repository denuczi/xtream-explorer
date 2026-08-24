import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Play } from 'lucide-react';
import { useI18n } from '../../i18n/useI18n';
import { useCatalogStore } from '../../stores/catalog-store';
import { usePlayerStore } from '../../stores/player-store';
import type { SeriesSummary } from '../../types/models';
import { DetailSkeleton, ErrorState } from '../../components/media/StatusViews';

interface SeriesDetailPanelProps {
  summary: SeriesSummary;
  onBack: () => void;
}

function formatSeasonLabel(word: string, season: { number: number; name: string | null }): string {
  if (season.name !== null) return season.name;
  return `${word} ${season.number}`;
}

export function SeriesDetailPanel({ summary, onBack }: SeriesDetailPanelProps) {
  const { t } = useI18n();
  const entry = useCatalogStore((state) => state.seriesDetails[summary.id]);
  const ensureSeriesDetail = useCatalogStore((state) => state.ensureSeriesDetail);
  const openPlayer = usePlayerStore((state) => state.open);

  const [activeSeason, setActiveSeason] = useState<number | null>(null);

  useEffect(() => {
    void ensureSeriesDetail(summary.id);
  }, [summary.id, ensureSeriesDetail]);

  const detail = entry?.data ?? null;

  const seasons = useMemo(() => {
    if (detail === null) return [];
    return [...detail.seasons].sort((a, b) => a.number - b.number);
  }, [detail]);

  // Default to the first season that actually has episodes (derived, no effect needed).
  const effectiveSeason = useMemo(() => {
    if (activeSeason !== null) return activeSeason;
    const withEpisodes = seasons.find((season) =>
      detail?.episodes.some((episode) => episode.seasonNumber === season.number),
    );
    return withEpisodes?.number ?? seasons[0]?.number ?? null;
  }, [activeSeason, seasons, detail]);

  const episodes = useMemo(() => {
    if (detail === null || effectiveSeason === null) return [];
    return detail.episodes
      .filter((episode) => episode.seasonNumber === effectiveSeason)
      .sort((a, b) => (a.episodeNumber ?? 0) - (b.episodeNumber ?? 0));
  }, [detail, effectiveSeason]);

  return (
    <div className="space-y-6">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-1.5 text-sm font-medium text-zinc-200 transition hover:bg-surface-raised focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        {t.catalog.backToGrid}
      </button>

      {entry === undefined || entry.status === 'loading' ? (
        <DetailSkeleton />
      ) : entry.status === 'error' ? (
        <ErrorState onRetry={() => void ensureSeriesDetail(summary.id)} />
      ) : detail !== null ? (
        <>
          <div className="flex flex-col gap-6 sm:flex-row">
            <div className="aspect-[2/3] w-40 shrink-0 overflow-hidden rounded-xl border border-line bg-surface-raised">
              {detail.cover !== null ? (
                <img
                  src={detail.cover}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className="h-full w-full object-cover"
                />
              ) : null}
            </div>

            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-zinc-100">
                {detail.name.length > 0 ? detail.name : summary.name}
              </h2>
              <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-500">
                {detail.releaseDate !== null && <span>{detail.releaseDate}</span>}
                {detail.genre !== null && <span>{detail.genre}</span>}
                {detail.rating !== null && <span>★ {detail.rating}</span>}
              </p>
              {detail.plot !== null && (
                <p className="mt-3 max-w-3xl text-sm leading-relaxed text-zinc-400">{detail.plot}</p>
              )}
            </div>
          </div>

          {seasons.length > 0 && (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2" role="tablist" aria-label={t.catalog.seasonsTitle}>
                {seasons.map((season) => {
                  const isActive = season.number === effectiveSeason;
                  return (
                    <button
                      key={season.number}
                      type="button"
                      role="tab"
                      aria-selected={isActive}
                      onClick={() => setActiveSeason(season.number)}
                      className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                        isActive
                          ? 'bg-accent text-white'
                          : 'border border-line bg-surface text-zinc-300 hover:bg-surface-raised hover:text-zinc-100'
                      }`}
                    >
                      {formatSeasonLabel(t.catalog.seasonWord, season)}
                    </button>
                  );
                })}
              </div>

              <ul className="scroll-slim fade-edges-y max-h-[55vh] divide-y divide-line overflow-y-auto rounded-xl border border-line bg-surface">
                {episodes.map((episode) => (
                  <li key={`${episode.seasonNumber}-${episode.id}`} className="flex items-center gap-3 px-3 py-2.5">
                    <div className="h-10 w-16 shrink-0 overflow-hidden rounded-md bg-surface-raised">
                      {episode.image !== null && (
                        <img
                          src={episode.image}
                          alt=""
                          loading="lazy"
                          decoding="async"
                          className="h-full w-full object-cover"
                        />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-zinc-100">
                        {episode.title.length > 0 ? episode.title : `${t.catalog.episodesTitle} ${episode.episodeNumber ?? ''}`}
                      </p>
                      <p className="text-[11px] uppercase tracking-wide text-zinc-500">
                        S{String(episode.seasonNumber).padStart(2, '0')}
                        {episode.episodeNumber !== null
                          ? `E${String(episode.episodeNumber).padStart(2, '0')}`
                          : ''}
                      </p>
                    </div>
                    <button
                      type="button"
                      aria-label={`${t.nav.series}: ${episode.title}`}
                      onClick={() => {
                        if (detail === null) return;
                        openPlayer({
                          kind: 'episode',
                          catalogType: 'series',
                          id: episode.id,
                          name: episode.title.length > 0 ? episode.title : summary.name,
                          seriesContext: {
                            episodes: detail.episodes.map((item) => ({
                              id: item.id,
                              title:
                                item.title.length > 0
                                  ? item.title
                                  : `${t.catalog.seasonWord} ${item.seasonNumber} · E${item.episodeNumber ?? ''}`,
                            })),
                            index: episodes.findIndex((candidate) => candidate.id === episode.id),
                          },
                        });
                      }}
                      className="shrink-0 rounded-lg border border-line bg-surface-raised p-2 text-zinc-300 transition hover:border-accent/60 hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                    >
                      <Play className="h-4 w-4" aria-hidden />
                    </button>
                  </li>
                ))}
                {episodes.length === 0 && (
                  <li className="px-3 py-6 text-center text-sm text-zinc-500">{t.catalog.empty}</li>
                )}
              </ul>
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}
