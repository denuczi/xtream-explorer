import { create } from 'zustand';
import { ApiError, getAllStreams, getCategories, getSeriesDetail, getStreams } from '../lib/api';
import { useConnectionStore } from './connection-store';
import type { CatalogItem, CatalogType, Category, SeriesDetail } from '../types/models';

export type LoadStatus = 'idle' | 'loading' | 'success' | 'error';

export interface CatalogEntry<T> {
  status: LoadStatus;
  data: T | null;
}

interface CategoriesState {
  categories: Record<CatalogType, CatalogEntry<Category[]>>;
  streams: Record<string, CatalogEntry<CatalogItem[]>>;
  seriesDetails: Record<string, CatalogEntry<SeriesDetail>>;
  activeCategoryId: Record<CatalogType, string | null>;
}

interface CatalogActions {
  ensureCategories: (type: CatalogType) => Promise<void>;
  selectCategory: (type: CatalogType, categoryId: string) => void;
  ensureStreams: (type: CatalogType, categoryId: string) => Promise<void>;
  ensureAllStreams: (type: CatalogType) => Promise<void>;
  ensureSeriesDetail: (seriesId: string) => Promise<void>;
  resetCatalog: () => void;
}

export type CatalogStore = CategoriesState & CatalogActions;

const emptyCategories: Record<CatalogType, CatalogEntry<Category[]>> = {
  tv: { status: 'idle', data: null },
  movies: { status: 'idle', data: null },
  series: { status: 'idle', data: null },
};

const initialState: CategoriesState = {
  categories: emptyCategories,
  streams: {},
  seriesDetails: {},
  activeCategoryId: { tv: null, movies: null, series: null },
};

/**
 * One in-flight controller per catalog type. Starting a new load for a tab
 * cancels the previous one; the abandoned entry is reset to idle
 * so a later visit refetches instead of getting stuck on "loading".
 */
interface InflightLoad {
  controller: AbortController;
  key: string | null; // null → categories load
}

const inflightByType: Record<CatalogType, InflightLoad | null> = {
  tv: null,
  movies: null,
  series: null,
};
const allInflightByType: Record<CatalogType, AbortController | null> = {
  tv: null,
  movies: null,
  series: null,
};
let categoriesInflight: InflightLoad | null = null;

function streamsKey(type: CatalogType, categoryId: string): string {
  return `${type}:${categoryId}`;
}

function isAbortException(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

export const useCatalogStore = create<CatalogStore>()((set, get) => ({
  ...initialState,

  ensureCategories: async (type) => {
    const current = get().categories[type];
    if (current.status === 'success' || current.status === 'loading') return;
    if (useConnectionStore.getState().connectionId === null) return;

    set((state) => ({
      categories: { ...state.categories, [type]: { status: 'loading', data: null } },
    }));

    categoriesInflight?.controller.abort();
    const controller = new AbortController();
    categoriesInflight = { controller, key: null };

    try {
      const items = await getCategories(
        useConnectionStore.getState().connectionId as string,
        type,
        controller.signal,
      );
      if (controller.signal.aborted) return;
      set((state) => ({
        categories: { ...state.categories, [type]: { status: 'success', data: items } },
      }));
    } catch (error) {
      if (controller.signal.aborted || isAbortException(error)) {
        // Leave a clean slate for the next attempt instead of a stuck loader.
        set((state) => ({
          categories: { ...state.categories, [type]: { status: 'idle', data: null } },
        }));
        return;
      }
      set((state) => ({
        categories: { ...state.categories, [type]: { status: 'error', data: null } },
      }));
    }
  },

  selectCategory: (type, categoryId) => {
    if (get().activeCategoryId[type] === categoryId) return;
    set((state) => ({
      activeCategoryId: { ...state.activeCategoryId, [type]: categoryId },
    }));
    void get().ensureStreams(type, categoryId);
  },

  ensureStreams: async (type, categoryId) => {
    const key = streamsKey(type, categoryId);
    const existing = get().streams[key];
    if (existing?.status === 'success' || existing?.status === 'loading') return;

    const connectionId = useConnectionStore.getState().connectionId;
    if (connectionId === null) return;

    // Cancel any previous in-flight load for this tab.
    inflightByType[type]?.controller.abort();
    const controller = new AbortController();
    inflightByType[type] = { controller, key };

    set((state) => ({
      streams: { ...state.streams, [key]: { status: 'loading', data: null } },
    }));

    try {
      const items = await getStreams(connectionId, type, categoryId, controller.signal);
      if (controller.signal.aborted) return;
      set((state) => ({
        streams: { ...state.streams, [key]: { status: 'success', data: items } },
      }));
    } catch (error) {
      if (controller.signal.aborted || isAbortException(error)) {
        // Abandoned mid-flight: leave the entry fetchable for the next visit.
        if (get().streams[key]?.status === 'loading') {
          set((state) => ({
            streams: { ...state.streams, [key]: { status: 'idle', data: null } },
          }));
        }
        return;
      }
      set((state) => ({
        streams: { ...state.streams, [key]: { status: 'error', data: null } },
      }));
    }
  },

  ensureAllStreams: async (type) => {
    const key = streamsKey(type, 'all');
    const existing = get().streams[key];
    if (existing?.status === 'success' || existing?.status === 'loading') return;

    const connectionId = useConnectionStore.getState().connectionId;
    if (connectionId === null) return;

    allInflightByType[type]?.abort();
    const controller = new AbortController();
    allInflightByType[type] = controller;

    set((state) => ({
      streams: { ...state.streams, [key]: { status: 'loading', data: null } },
    }));

    try {
      const items = await getAllStreams(connectionId, type, controller.signal);
      if (controller.signal.aborted) return;
      set((state) => ({
        streams: { ...state.streams, [key]: { status: 'success', data: items } },
      }));
    } catch (error) {
      if (controller.signal.aborted || isAbortException(error)) {
        if (get().streams[key]?.status === 'loading') {
          set((state) => ({
            streams: { ...state.streams, [key]: { status: 'idle', data: null } },
          }));
        }
        return;
      }
      set((state) => ({
        streams: { ...state.streams, [key]: { status: 'error', data: null } },
      }));
    }
  },

  ensureSeriesDetail: async (seriesId) => {
    const existing = get().seriesDetails[seriesId];
    if (existing?.status === 'success' || existing?.status === 'loading') return;

    const connectionId = useConnectionStore.getState().connectionId;
    if (connectionId === null) return;

    set((state) => ({
      seriesDetails: { ...state.seriesDetails, [seriesId]: { status: 'loading', data: null } },
    }));

    try {
      const detail = await getSeriesDetail(connectionId, seriesId);
      set((state) => ({
        seriesDetails: { ...state.seriesDetails, [seriesId]: { status: 'success', data: detail } },
      }));
    } catch (error) {
      if (error instanceof ApiError && error.code === 'SESSION_NOT_FOUND') {
        // The session died server-side: drop catalog + connection together.
        get().resetCatalog();
        useConnectionStore.getState().reset();
        return;
      }
      set((state) => ({
        seriesDetails: { ...state.seriesDetails, [seriesId]: { status: 'error', data: null } },
      }));
    }
  },

  resetCatalog: () => {
    for (const type of Object.keys(inflightByType) as CatalogType[]) {
      inflightByType[type]?.controller.abort();
      inflightByType[type] = null;
    }
    for (const type of Object.keys(allInflightByType) as CatalogType[]) {
      allInflightByType[type]?.abort();
      allInflightByType[type] = null;
    }
    categoriesInflight?.controller.abort();
    categoriesInflight = null;
    set({ ...initialState });
  },
}));
