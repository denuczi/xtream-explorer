import { create } from 'zustand';
import type { PlayRequest } from '../types/models';

interface PlayerState {
  /** Null → modal unmounted, zero resources held. */
  target: PlayRequest | null;
  open: (request: PlayRequest) => void;
  close: () => void;
}

/**
 * Single global playback slot: opening another item swaps the target without
 * closing/reopening the modal. The page underneath never moves.
 */
export const usePlayerStore = create<PlayerState>()((set) => ({
  target: null,
  open: (request) => set({ target: request }),
  close: () => set({ target: null }),
}));
