import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface CachedMessage {
  id: string;
  sender_id: string;
  content: string;      // stored as decrypted plaintext
  created_at: string;
  read_at?: string | null;
}

// Keep at most this many messages per conversation in localStorage
const MAX_PER_CHAT = 300;

interface MessageStoreState {
  chats: Record<string, CachedMessage[]>;
  setChat:      (contactId: string, messages: CachedMessage[]) => void;
  appendMessage:(contactId: string, message: CachedMessage)    => void;
  patchMessage: (contactId: string, id: string, patch: Partial<CachedMessage>) => void;
  clearChat:    (contactId: string) => void;
}

export const useMessageStore = create<MessageStoreState>()(
  persist(
    (set) => ({
      chats: {},

      setChat: (contactId, messages) =>
        set(s => ({
          chats: {
            ...s.chats,
            [contactId]: messages.slice(-MAX_PER_CHAT),
          },
        })),

      appendMessage: (contactId, message) =>
        set(s => {
          const existing = s.chats[contactId] ?? [];
          if (existing.some(m => m.id === message.id)) return s; // deduplicate
          return {
            chats: {
              ...s.chats,
              [contactId]: [...existing, message].slice(-MAX_PER_CHAT),
            },
          };
        }),

      patchMessage: (contactId, id, patch) =>
        set(s => ({
          chats: {
            ...s.chats,
            [contactId]: (s.chats[contactId] ?? []).map(m =>
              m.id === id ? { ...m, ...patch } : m
            ),
          },
        })),

      clearChat: (contactId) =>
        set(s => {
          const { [contactId]: _removed, ...rest } = s.chats;
          return { chats: rest };
        }),
    }),
    { name: 'aero-message-cache' }
  )
);
