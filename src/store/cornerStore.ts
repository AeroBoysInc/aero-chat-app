import { create } from 'zustand';

export type SelectedGame = 'bubblepop' | null;

interface CornerStore {
  gameViewActive: boolean;
  selectedGame: SelectedGame;
  openGameHub: () => void;
  closeGameView: () => void;
  selectGame: (game: SelectedGame) => void;
}

export const useCornerStore = create<CornerStore>()((set) => ({
  gameViewActive: false,
  selectedGame: null,
  openGameHub: () => set({ gameViewActive: true }),
  closeGameView: () => set({ gameViewActive: false, selectedGame: null }),
  selectGame: (selectedGame) => set({ selectedGame }),
}));
