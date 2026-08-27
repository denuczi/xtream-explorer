import { create } from 'zustand';
import { ApiError, connectPlaylist, deleteConnection, postConnection } from '../lib/api';
import type {
  AccountInfo,
  ApiErrorCode,
  ConnectionCredentials,
  ConnectionStatus,
} from '../types/models';

interface ConnectionState {
  status: ConnectionStatus;
  connectionId: string | null;
  account: AccountInfo | null;
  errorCode: ApiErrorCode | null;
  /** Set when the active session came from a saved playlist. */
  lastPlaylistId: string | null;
}

interface ConnectionActions {
  connect: (credentials: ConnectionCredentials) => Promise<void>;
  connectSaved: (playlistId: string) => Promise<void>;
  disconnect: () => Promise<void>;
  reset: () => void;
}

type ConnectionStore = ConnectionState & ConnectionActions;

const initialState: ConnectionState = {
  status: 'disconnected',
  connectionId: null,
  account: null,
  errorCode: null,
  lastPlaylistId: null,
};

export const useConnectionStore = create<ConnectionStore>()((set, get) => ({
  ...initialState,

  connect: async (credentials) => {
    set({ status: 'connecting', errorCode: null });
    try {
      const result = await postConnection(credentials);
      set({
        status: 'connected',
        connectionId: result.connectionId,
        account: result.account,
        errorCode: null,
        lastPlaylistId: null,
      });
    } catch (error) {
      set({
        status: 'error',
        errorCode: error instanceof ApiError ? error.code : 'NETWORK_ERROR',
      });
    }
  },

  connectSaved: async (playlistId) => {
    set({ status: 'connecting', errorCode: null });
    try {
      const result = await connectPlaylist(playlistId);
      set({
        status: 'connected',
        connectionId: result.connectionId,
        account: result.account,
        errorCode: null,
        lastPlaylistId: result.playlistId ?? playlistId,
      });
    } catch (error) {
      set({
        status: 'error',
        errorCode: error instanceof ApiError ? error.code : 'NETWORK_ERROR',
      });
    }
  },

  disconnect: async () => {
    const { connectionId } = get();
    if (connectionId !== null) {
      try {
        await deleteConnection(connectionId);
      } catch {
        // The session may already be gone server-side; nothing to recover.
      }
    }
    get().reset();
  },

  reset: () => set({ ...initialState }),
}));
