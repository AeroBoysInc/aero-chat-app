import { create } from 'zustand';

export type TourAction = 'theme-switcher' | 'identity-editor' | 'bubble-picker' | 'settings' | null;

interface TourState {
  open: boolean;
  pendingAction: TourAction;
  openTour: () => void;
  closeTour: () => void;
  markSeen: (userId: string) => void;
  hasSeen: (userId: string) => boolean;
  setPendingAction: (action: TourAction) => void;
  clearPendingAction: () => void;
}

export const useTourStore = create<TourState>((set) => ({
  open: false,
  pendingAction: null,

  openTour: () => set({ open: true }),
  closeTour: () => set({ open: false }),

  markSeen: (userId: string) => {
    localStorage.setItem(`aero-premium-tour-seen-${userId}`, '1');
  },

  hasSeen: (userId: string) => {
    return localStorage.getItem(`aero-premium-tour-seen-${userId}`) === '1';
  },

  setPendingAction: (action: TourAction) => set({ pendingAction: action }),
  clearPendingAction: () => set({ pendingAction: null }),
}));
