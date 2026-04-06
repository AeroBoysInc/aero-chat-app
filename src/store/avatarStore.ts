// src/store/avatarStore.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { type EquippedItems } from '../lib/avatarConfig';

interface AvatarState {
  selectedBase: string; // avatar base id, e.g. 'flutter'
  equipped: EquippedItems;
}

interface AvatarActions {
  setBase: (id: string) => void;
  equipItem: (slot: keyof EquippedItems, src: string) => void;
  unequipItem: (slot: keyof EquippedItems) => void;
}

type AvatarStore = AvatarState & AvatarActions;

export const useAvatarStore = create<AvatarStore>()(
  persist(
    (set) => ({
      selectedBase: 'flutter',
      equipped: {},

      setBase: (id) => set({ selectedBase: id }),

      equipItem: (slot, src) =>
        set((s) => ({ equipped: { ...s.equipped, [slot]: src } })),

      unequipItem: (slot) =>
        set((s) => {
          const next = { ...s.equipped };
          delete next[slot];
          return { equipped: next };
        }),
    }),
    { name: 'aero-avatar' },
  ),
);
