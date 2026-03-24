import { create } from 'zustand';

interface PresenceState {
  onlineIds: Set<string>;
  presenceReady: boolean;
  playingGames: Map<string, string>;
  setOnlineIds: (ids: Set<string>) => void;
  setPresenceReady: (ready: boolean) => void;
  setPlayingGames: (games: Map<string, string>) => void;
}

export const usePresenceStore = create<PresenceState>((set) => ({
  onlineIds:     new Set<string>(),
  presenceReady: false,
  playingGames:  new Map<string, string>(),
  setOnlineIds:     (ids)   => set({ onlineIds: ids }),
  setPresenceReady: (ready) => set({ presenceReady: ready }),
  setPlayingGames:  (games) => set({ playingGames: games }),
}));
