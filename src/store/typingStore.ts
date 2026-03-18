import { create } from 'zustand';

interface TypingStore {
  typing: Record<string, boolean>; // userId → isTyping
  setTyping: (userId: string, isTyping: boolean) => void;
}

export const useTypingStore = create<TypingStore>()((set) => ({
  typing: {},
  setTyping: (userId, isTyping) =>
    set(state => ({ typing: { ...state.typing, [userId]: isTyping } })),
}));
