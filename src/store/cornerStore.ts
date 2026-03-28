import { create } from 'zustand';

export type SelectedGame = 'bubblepop' | 'tropico' | 'twentyfortyeight' | 'typingtest' | 'wordle' | 'chess' | null;

export type GameChatOverlay = null | { mode: 'picker' } | { mode: 'conversation'; senderId: string };

interface CornerStore {
  gameViewActive: boolean;
  devViewActive: boolean;
  writerViewActive: boolean;
  selectedGame: SelectedGame;
  gameChatOverlay: GameChatOverlay;
  openGameHub: () => void;
  closeGameView: () => void;
  selectGame: (game: SelectedGame) => void;
  openDevView: () => void;
  closeDevView: () => void;
  openWriterHub: () => void;
  closeWriterView: () => void;
  openGameChat: () => void;
  openGameChatFor: (senderId: string) => void;
  closeGameChat: () => void;
}

export const useCornerStore = create<CornerStore>()((set) => ({
  gameViewActive: false,
  devViewActive: false,
  writerViewActive: false,
  selectedGame: null,
  gameChatOverlay: null,
  openGameHub:      () => set({ gameViewActive: true,  writerViewActive: false, devViewActive: false }),
  closeGameView:    () => set({ gameViewActive: false, selectedGame: null, gameChatOverlay: null }),
  selectGame:       (selectedGame) => set({ selectedGame }),
  openDevView:      () => set({ devViewActive: true,   gameViewActive: false, writerViewActive: false, selectedGame: null, gameChatOverlay: null }),
  closeDevView:     () => set({ devViewActive: false }),
  openWriterHub:    () => set({ writerViewActive: true, gameViewActive: false, devViewActive: false, selectedGame: null, gameChatOverlay: null }),
  closeWriterView:  () => set({ writerViewActive: false }),
  openGameChat:     () => set({ gameChatOverlay: { mode: 'picker' } }),
  openGameChatFor:  (senderId) => set({ gameChatOverlay: { mode: 'conversation', senderId } }),
  closeGameChat:    () => set({ gameChatOverlay: null }),
}));
