import { CatalogBrowser } from '../../components/media/CatalogBrowser';

interface MoviesPageProps {
  connectionId: string;
}

export function MoviesPage({ connectionId }: MoviesPageProps) {
  return <CatalogBrowser type="movies" variant="poster" connectionId={connectionId} />;
}
