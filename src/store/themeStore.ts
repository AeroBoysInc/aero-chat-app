import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase } from '../lib/supabase';

export type Theme = 'day' | 'night' | 'ocean' | 'sunset' | 'aurora' | 'sakura' | 'john-frutiger' | 'golden-hour';

export const FREE_THEMES: Theme[] = ['day', 'night'];
export const PREMIUM_THEMES: Theme[] = ['ocean', 'sunset', 'aurora', 'sakura'];
export const ULTRA_THEMES: Theme[] = ['john-frutiger', 'golden-hour'];
export const ALL_THEMES: Theme[] = [...FREE_THEMES, ...PREMIUM_THEMES, ...ULTRA_THEMES];

export function isUltraTheme(t: Theme): boolean {
  return ULTRA_THEMES.includes(t);
}

interface ThemeStore {
  theme: Theme;
  ownsJohnFrutiger: boolean;
  ownsGoldenHour: boolean;
  setTheme: (t: Theme) => void;
  loadOwnership: (userId: string) => Promise<void>;
  purchaseTheme: (theme: 'john-frutiger' | 'golden-hour', userId: string) => Promise<boolean>;
}

export const useThemeStore = create<ThemeStore>()(
  persist(
    (set, _get) => ({
      theme: 'day',
      ownsJohnFrutiger: false,
      ownsGoldenHour: false,

      setTheme: (theme) => {
        set({ theme });
        document.documentElement.setAttribute('data-theme', theme);
      },

      loadOwnership: async (userId) => {
        const { data } = await supabase
          .from('profiles')
          .select('owns_john_frutiger, owns_golden_hour')
          .eq('id', userId)
          .single();
        if (data) {
          set({
            ownsJohnFrutiger: data.owns_john_frutiger ?? false,
            ownsGoldenHour: data.owns_golden_hour ?? false,
          });
        }
      },

      purchaseTheme: async (theme, userId) => {
        const col = theme === 'john-frutiger' ? 'owns_john_frutiger' : 'owns_golden_hour';
        const { error } = await supabase
          .from('profiles')
          .update({ [col]: true })
          .eq('id', userId);
        if (error) return false;
        set(theme === 'john-frutiger'
          ? { ownsJohnFrutiger: true }
          : { ownsGoldenHour: true }
        );
        return true;
      },
    }),
    {
      name: 'aero-theme',
      partialize: (state) => ({ theme: state.theme }),
    }
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
