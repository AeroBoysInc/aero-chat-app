import { create } from 'zustand';
import type { Profile } from './authStore';
import { saveSelectedContactId } from '../lib/chatCache';

interface ChatStore {
  selectedContact: Profile | null;
  setSelectedContact: (c: Profile | null) => void;
}

export const useChatStore = create<ChatStore>()((set) => ({
  selectedContact: null,
  setSelectedContact: (selectedContact) => {
    // Persist the contact ID synchronously so it survives a page refresh
    saveSelectedContactId(selectedContact?.id ?? null);
    set({ selectedContact });
  },
}));
