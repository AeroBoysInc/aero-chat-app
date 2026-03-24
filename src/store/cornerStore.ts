import { create } from 'zustand';

export type SelectedGame = 'bubblepop' | 'tropico' | 'twentyfortyeight' | 'typingtest' | 'wordle' | 'chess' | null;

export type GameChatOverlay = null | { mode: 'picker' } | { mode: 'conversation'; senderId: string };

interface CornerStore {
  gameViewActive: boolean;
  devViewActive: boolean;
  selectedGame: SelectedGame;
  gameChatOverlay: GameChatOverlay;
  openGameHub: () => void;
  closeGameView: () => void;
  selectGame: (game: SelectedGame) => void;
  openDevView: () => void;
  closeDevView: () => void;
  openGameChat: () => void;
  openGameChatFor: (senderId: string) => void;
  closeGameChat: () => void;
}

export const useCornerStore = create<CornerStore>()((set) => ({
  gameViewActive: false,
  devViewActive: false,
  selectedGame: null,
  gameChatOverlay: null,
  openGameHub:      () => set({ gameViewActive: true,  devViewActive: false }),
  closeGameView:    () => set({ gameViewActive: false, selectedGame: null, gameChatOverlay: null }),
  selectGame:       (selectedGame) => set({ selectedGame }),
  openDevView:      () => set({ devViewActive: true,   gameViewActive: false, selectedGame: null, gameChatOverlay: null }),
  closeDevView:     () => set({ devViewActive: false }),
  openGameChat:     () => set({ gameChatOverlay: { mode: 'picker' } }),
  openGameChatFor:  (senderId) => set({ gameChatOverlay: { mode: 'conversation', senderId } }),
  closeGameChat:    () => set({ gameChatOverlay: null }),
}));
