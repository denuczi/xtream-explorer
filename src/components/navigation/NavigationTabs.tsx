import { Clapperboard, Film, Tv, type LucideIcon } from 'lucide-react';
import { useI18n } from '../../i18n/useI18n';

export type CatalogTab = 'tv' | 'movies' | 'series';

interface TabDefinition {
  id: CatalogTab;
  icon: LucideIcon;
}

const TABS: readonly TabDefinition[] = [
  { id: 'tv', icon: Tv },
  { id: 'movies', icon: Film },
  { id: 'series', icon: Clapperboard },
];

interface NavigationTabsProps {
  active: CatalogTab;
  onChange: (tab: CatalogTab) => void;
}

export function NavigationTabs({ active, onChange }: NavigationTabsProps) {
  const { t } = useI18n();

  return (
    <nav aria-label="Catalog" className="flex gap-2">
      {TABS.map(({ id, icon: Icon }) => {
        const isActive = id === active;
        return (
          <button
            key={id}
            type="button"
            aria-current={isActive ? 'page' : undefined}
            onClick={() => onChange(id)}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition ${
              isActive
                ? 'bg-accent text-white'
                : 'border border-line bg-surface text-zinc-300 hover:bg-surface-raised hover:text-zinc-100'
            }`}
          >
            <Icon className="h-4 w-4" aria-hidden />
            {t.nav[id]}
          </button>
        );
      })}
    </nav>
  );
}
