import { create } from 'zustand';
import type { Profile } from './authStore';

interface ChatStore {
  selectedContact: Profile | null;
  selectedGroupId: string | null;
  setSelectedContact: (c: Profile | null) => void;
  setSelectedGroupId: (id: string | null) => void;
}

export const useChatStore = create<ChatStore>()((set) => ({
  selectedContact: null,
  selectedGroupId: null,
  setSelectedContact: (selectedContact) => set({ selectedContact, selectedGroupId: null }),
  setSelectedGroupId: (selectedGroupId) => set({ selectedGroupId, selectedContact: null }),
}));
