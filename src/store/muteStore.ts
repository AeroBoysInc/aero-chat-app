import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface MuteStore {
  /** Set of friend user IDs whose message sounds are muted */
  mutedIds: Set<string>;
  isMuted: (friendId: string) => boolean;
  toggleMute: (friendId: string) => void;
}

export const useMuteStore = create<MuteStore>()(
  persist(
    (set, get) => ({
      mutedIds: new Set(),
      isMuted: (friendId) => get().mutedIds.has(friendId),
      toggleMute: (friendId) => set(state => {
        const next = new Set(state.mutedIds);
        if (next.has(friendId)) next.delete(friendId);
        else next.add(friendId);
        return { mutedIds: next };
      }),
    }),
    {
      name: 'aero-muted-friends',
      storage: {
        getItem: (name) => {
          const raw = localStorage.getItem(name);
          if (!raw) return null;
          const parsed = JSON.parse(raw);
          // Rehydrate Set from array
          if (parsed?.state?.mutedIds) {
            parsed.state.mutedIds = new Set(parsed.state.mutedIds);
          }
          return parsed;
        },
        setItem: (name, value) => {
          // Serialize Set as array
          const serialized = {
            ...value,
            state: {
              ...value.state,
              mutedIds: Array.from(value.state.mutedIds),
            },
          };
          localStorage.setItem(name, JSON.stringify(serialized));
        },
        removeItem: (name) => localStorage.removeItem(name),
      },
    },
  ),
);
