import { CatalogBrowser } from '../../components/media/CatalogBrowser';

interface TvPageProps {
  connectionId: string;
}

export function TvPage({ connectionId }: TvPageProps) {
  return <CatalogBrowser type="tv" variant="channel" connectionId={connectionId} />;
}
