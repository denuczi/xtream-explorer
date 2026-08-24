import { useCallback, useState } from 'react';
import { CatalogBrowser } from '../../components/media/CatalogBrowser';
import { SeriesDetailPanel } from './SeriesDetailPanel';
import type { SeriesSummary } from '../../types/models';

interface SeriesPageProps {
  connectionId: string;
}

export function SeriesPage({ connectionId }: SeriesPageProps) {
  const [selected, setSelected] = useState<SeriesSummary | null>(null);
  const handleSelectSeries = useCallback((series: SeriesSummary) => setSelected(series), []);

  if (selected !== null) {
    return (
      <SeriesDetailPanel
        key={selected.id}
        summary={selected}
        onBack={() => setSelected(null)}
      />
    );
  }

  return (
    <CatalogBrowser
      type="series"
      variant="poster"
      connectionId={connectionId}
      onSelectSeries={handleSelectSeries}
    />
  );
}
