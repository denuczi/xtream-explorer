import { create } from 'zustand';
import { deletePlaylist, getPlaylists } from '../lib/api';
import type { SavedPlaylist } from '../types/models';

interface PlaylistsState {
  items: SavedPlaylist[];
  loading: boolean;
}

interface PlaylistsActions {
  refresh: () => Promise<void>;
  remove: (playlistId: string) => Promise<void>;
}

export const usePlaylistsStore = create<PlaylistsState & PlaylistsActions>()((set, get) => ({
  items: [],
  loading: false,

  refresh: async () => {
    if (get().loading) return;
    set({ loading: true });
    try {
      const items = await getPlaylists();
      set({ items, loading: false });
    } catch {
      // Local endpoint; a failure just leaves the previous list visible.
      set({ loading: false });
    }
  },

  remove: async (playlistId) => {
    await deletePlaylist(playlistId);
    set((state) => ({ items: state.items.filter((item) => item.id !== playlistId) }));
  },
}));
