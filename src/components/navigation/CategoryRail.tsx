import { useEffect, useMemo, useState } from 'react';
import { useOverflowY } from '../../hooks/useOverflowY';
import { Search } from 'lucide-react';
import { useI18n } from '../../i18n/useI18n';
import { useCatalogStore } from '../../stores/catalog-store';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import type { CatalogType } from '../../types/models';
import { ErrorState, RailSkeleton } from '../media/StatusViews';

interface CategoryRailProps {
  type: CatalogType;
  connectionId: string;
  /** Provided by CatalogBrowser: selecting a category exits search mode. */
  onSelectCategory?: (categoryId: string) => void;
}

export function CategoryRail({ type, connectionId, onSelectCategory }: CategoryRailProps) {
  const { t } = useI18n();
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebouncedValue(query.trim().toLowerCase(), 200);

  const [navRef, navOverflows] = useOverflowY<HTMLElement>();
  const entry = useCatalogStore((state) => state.categories[type]);
  const activeId = useCatalogStore((state) => state.activeCategoryId[type]);
  const selectCategory = useCatalogStore((state) => state.selectCategory);
  const ensureCategories = useCatalogStore((state) => state.ensureCategories);

  // Re-runs when the connection changes: this is what makes TV load right
  // after a successful connect instead of only on tab remounts.
  useEffect(() => {
    void ensureCategories(type);
  }, [type, connectionId, ensureCategories]);

  const categories = useMemo(() => {
    if (entry.data === null) return [];
    if (debouncedQuery.length === 0) return entry.data;
    return entry.data.filter((category) => category.name.toLowerCase().includes(debouncedQuery));
  }, [entry.data, debouncedQuery]);

  return (
    <aside className="w-full shrink-0 lg:w-[220px]">
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30"
          aria-hidden
        />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t.catalog.searchCategories}
          className="w-full rounded-[10px] border border-line bg-surface py-2 pl-9 pr-3 text-[13px] text-white placeholder:text-white/30 outline-none transition focus:border-white/20 focus:ring-2 focus:ring-white/10"
        />
      </div>

      <div className="relative">
        <nav
          ref={navRef}
          aria-label={t.nav[type]}
          className={`scroll-slim mt-3 flex max-h-40 gap-1.5 overflow-x-auto pb-1 lg:max-h-[calc(100vh-20rem)] lg:flex-col lg:overflow-y-auto lg:overflow-x-hidden lg:pr-1.5 ${
            navOverflows ? 'fade-edges-y' : ''
          }`}
        >
          {entry.status === 'loading' && <RailSkeleton />}
          {entry.status === 'error' && (
            <ErrorState compact onRetry={() => void ensureCategories(type)} />
          )}
          {entry.status === 'success' &&
            categories.map((category) => {
              const isActive = category.id === activeId;
              return (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => {
                    if (onSelectCategory !== undefined) {
                      onSelectCategory(category.id);
                    } else {
                      selectCategory(type, category.id);
                    }
                  }}
                  aria-current={isActive ? 'true' : undefined}
                  title={category.name.length > 0 ? category.name : undefined}
                  className={`shrink-0 cursor-pointer whitespace-nowrap rounded-[10px] px-3 py-2 text-left text-[13px] transition lg:w-full ${
                    isActive
                      ? 'bg-white font-medium text-app'
                      : 'text-white/60 hover:bg-hover hover:text-white'
                  }`}
                >
                  {category.name.length > 0 ? category.name : t.catalog.untitled}
                </button>
              );
            })}
        </nav>
      </div>
    </aside>
  );
}
