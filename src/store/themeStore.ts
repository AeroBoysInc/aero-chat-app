import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Theme = 'day' | 'night';

interface ThemeStore {
  theme: Theme;
  setTheme: (t: Theme) => void;
}

export const useThemeStore = create<ThemeStore>()(
  persist(
    (set) => ({
      theme: 'day',
      setTheme: (theme) => {
        set({ theme });
        document.documentElement.setAttribute('data-theme', theme);
      },
    }),
    { name: 'aero-theme' }
  )
);

/** Call before React renders to prevent theme flash */
export function initTheme() {
  try {
    const raw = localStorage.getItem('aero-theme');
    if (raw) {
      const theme = JSON.parse(raw)?.state?.theme;
      if (theme) document.documentElement.setAttribute('data-theme', theme);
    }
  } catch {}
}
