import { create } from 'zustand';

interface UnreadStore {
  counts: Record<string, number>;
  increment: (senderId: string) => void;
  clear: (senderId: string) => void;
  seed: (counts: Record<string, number>) => void;
}

export const useUnreadStore = create<UnreadStore>()((set) => ({
  counts: {},
  increment: (senderId) =>
    set(state => ({ counts: { ...state.counts, [senderId]: (state.counts[senderId] ?? 0) + 1 } })),
  clear: (senderId) =>
    set(state => { const c = { ...state.counts }; delete c[senderId]; return { counts: c }; }),
  seed: (counts) => set({ counts }),
}));
