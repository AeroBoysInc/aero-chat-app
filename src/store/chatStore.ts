import { create } from 'zustand';
import type { Profile } from './authStore';

interface ChatStore {
  selectedContact: Profile | null;
  setSelectedContact: (c: Profile | null) => void;
}

export const useChatStore = create<ChatStore>()((set) => ({
  selectedContact: null,
  setSelectedContact: (selectedContact) => set({ selectedContact }),
}));
