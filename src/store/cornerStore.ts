// src/store/cornerStore.ts
import { create } from 'zustand';

export type SelectedGame = 'bubblepop' | 'tropico' | 'twentyfortyeight' | 'typingtest' | 'wordle' | 'chess' | null;

export type GameChatOverlay = null | { mode: 'picker' } | { mode: 'conversation'; senderId: string };

interface CornerStore {
  gameViewActive: boolean;
  devViewActive: boolean;
  writerViewActive: boolean;
  calendarViewActive: boolean;
  avatarViewActive: boolean;
  selectedGame: SelectedGame;
  gameChatOverlay: GameChatOverlay;
  serverView: null | 'overlay' | 'server' | 'bubble';
  openGameHub: () => void;
  closeGameView: () => void;
  selectGame: (game: SelectedGame) => void;
  openDevView: () => void;
  closeDevView: () => void;
  openWriterHub: () => void;
  closeWriterView: () => void;
  openCalendarView: () => void;
  closeCalendarView: () => void;
  openAvatarView: () => void;
  closeAvatarView: () => void;
  openGameChat: () => void;
  openGameChatFor: (senderId: string) => void;
  closeGameChat: () => void;
  openServerOverlay: () => void;
  closeServerOverlay: () => void;
  enterServer: () => void;
  enterBubble: () => void;
  exitToHub: () => void;
  exitToDMs: () => void;
}

export const useCornerStore = create<CornerStore>()((set) => ({
  gameViewActive:     false,
  devViewActive:      false,
  writerViewActive:   false,
  calendarViewActive: false,
  avatarViewActive:   false,
  selectedGame:       null,
  gameChatOverlay:    null,
  serverView:         null,
  openGameHub:        () => set({ gameViewActive: true,  writerViewActive: false, devViewActive: false, calendarViewActive: false, avatarViewActive: false, serverView: null }),
  closeGameView:      () => set({ gameViewActive: false, selectedGame: null, gameChatOverlay: null }),
  selectGame:         (selectedGame) => set({ selectedGame }),
  openDevView:        () => set({ devViewActive: true,   gameViewActive: false, writerViewActive: false, calendarViewActive: false, avatarViewActive: false, selectedGame: null, gameChatOverlay: null, serverView: null }),
  closeDevView:       () => set({ devViewActive: false }),
  openWriterHub:      () => set({ writerViewActive: true, gameViewActive: false, devViewActive: false, calendarViewActive: false, avatarViewActive: false, selectedGame: null, gameChatOverlay: null, serverView: null }),
  closeWriterView:    () => set({ writerViewActive: false }),
  openCalendarView:   () => set({ calendarViewActive: true, gameViewActive: false, devViewActive: false, writerViewActive: false, avatarViewActive: false, selectedGame: null, gameChatOverlay: null, serverView: null }),
  closeCalendarView:  () => set({ calendarViewActive: false }),
  openAvatarView:     () => set({ avatarViewActive: true, gameViewActive: false, devViewActive: false, writerViewActive: false, calendarViewActive: false, selectedGame: null, gameChatOverlay: null, serverView: null }),
  closeAvatarView:    () => set({ avatarViewActive: false }),
  openGameChat:       () => set({ gameChatOverlay: { mode: 'picker' } }),
  openGameChatFor:    (senderId) => set({ gameChatOverlay: { mode: 'conversation', senderId } }),
  closeGameChat:      () => set({ gameChatOverlay: null }),
  openServerOverlay:  () => set({ serverView: 'overlay', gameViewActive: false, devViewActive: false, writerViewActive: false, calendarViewActive: false, avatarViewActive: false, selectedGame: null, gameChatOverlay: null }),
  closeServerOverlay: () => set({ serverView: null }),
  enterServer:        () => set({ serverView: 'server' }),
  enterBubble:        () => set({ serverView: 'bubble' }),
  exitToHub:          () => set({ serverView: 'server' }),
  exitToDMs:          () => set({ serverView: null }),
}));
