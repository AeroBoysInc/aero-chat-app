import { create } from 'zustand';

export type SelectedGame = 'bubblepop' | 'tropico' | null;

interface CornerStore {
  gameViewActive: boolean;
  devViewActive: boolean;
  selectedGame: SelectedGame;
  openGameHub: () => void;
  closeGameView: () => void;
  selectGame: (game: SelectedGame) => void;
  openDevView: () => void;
  closeDevView: () => void;
}

export const useCornerStore = create<CornerStore>()((set) => ({
  gameViewActive: false,
  devViewActive: false,
  selectedGame: null,
  openGameHub:  () => set({ gameViewActive: true,  devViewActive: false }),
  closeGameView:() => set({ gameViewActive: false, selectedGame: null }),
  selectGame:   (selectedGame) => set({ selectedGame }),
  openDevView:  () => set({ devViewActive: true,   gameViewActive: false, selectedGame: null }),
  closeDevView: () => set({ devViewActive: false }),
}));
