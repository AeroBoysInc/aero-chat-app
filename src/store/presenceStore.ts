import { create } from 'zustand';

interface PresenceState {
  onlineIds: Set<string>;
  presenceReady: boolean;
  setOnlineIds: (ids: Set<string>) => void;
  setPresenceReady: (ready: boolean) => void;
}

export const usePresenceStore = create<PresenceState>((set) => ({
  onlineIds: new Set<string>(),
  presenceReady: false,
  setOnlineIds: (ids) => set({ onlineIds: ids }),
  setPresenceReady: (ready) => set({ presenceReady: ready }),
}));
