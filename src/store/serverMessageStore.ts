// src/store/serverMessageStore.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { BubbleMessage } from '../lib/serverTypes';

const MAX_PER_BUBBLE = 200;

interface ServerMessageStoreState {
  bubbles: Record<string, BubbleMessage[]>;
  setBubble: (bubbleId: string, messages: BubbleMessage[]) => void;
  appendMessage: (bubbleId: string, message: BubbleMessage) => void;
  clearBubble: (bubbleId: string) => void;
}

export const useServerMessageStore = create<ServerMessageStoreState>()(
  persist(
    (set) => ({
      bubbles: {},

      setBubble: (bubbleId, messages) =>
        set(s => ({
          bubbles: {
            ...s.bubbles,
            [bubbleId]: messages.slice(-MAX_PER_BUBBLE),
          },
        })),

      appendMessage: (bubbleId, message) =>
        set(s => {
          const existing = s.bubbles[bubbleId] ?? [];
          if (existing.some(m => m.id === message.id)) return s;
          return {
            bubbles: {
              ...s.bubbles,
              [bubbleId]: [...existing, message].slice(-MAX_PER_BUBBLE),
            },
          };
        }),

      clearBubble: (bubbleId) =>
        set(s => {
          const { [bubbleId]: _, ...rest } = s.bubbles;
          return { bubbles: rest };
        }),
    }),
    { name: 'aero-server-message-cache' }
  )
);
