import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase } from '../lib/supabase';

export type Theme = 'day' | 'night' | 'ocean' | 'sunset' | 'aurora' | 'sakura' | 'john-frutiger' | 'golden-hour' | 'master';

export const FREE_THEMES: Theme[] = ['day', 'night'];
export const PREMIUM_THEMES: Theme[] = ['ocean', 'sunset', 'aurora', 'sakura'];
export const ULTRA_THEMES: Theme[] = ['john-frutiger', 'golden-hour'];
export const MASTER_THEMES: Theme[] = ['master'];
export const ALL_THEMES: Theme[] = [...FREE_THEMES, ...PREMIUM_THEMES, ...ULTRA_THEMES, ...MASTER_THEMES];

export type ThemeTier = 'free' | 'premium' | 'ultra' | 'master';

export function getThemeTier(theme: Theme): ThemeTier {
  if (PREMIUM_THEMES.includes(theme)) return 'premium';
  if (ULTRA_THEMES.includes(theme)) return 'ultra';
  if (MASTER_THEMES.includes(theme)) return 'master';
  return 'free';
}

export function isUltraTheme(t: Theme): boolean {
  return ULTRA_THEMES.includes(t);
}

export function isMasterTheme(t: Theme): boolean {
  return MASTER_THEMES.includes(t);
}

interface ThemeStore {
  theme: Theme;
  ownsJohnFrutiger: boolean;
  ownsGoldenHour: boolean;
  ownsMaster: boolean;
  setTheme: (t: Theme) => void;
  loadOwnership: (userId: string) => Promise<void>;
  purchaseTheme: (theme: 'john-frutiger' | 'golden-hour' | 'master', userId: string) => Promise<boolean>;
}

export const useThemeStore = create<ThemeStore>()(
  persist(
    (set, _get) => ({
      theme: 'day',
      ownsJohnFrutiger: false,
      ownsGoldenHour: false,
      ownsMaster: false,

      setTheme: (theme) => {
        set({ theme });
        document.documentElement.setAttribute('data-theme', theme);
      },

      loadOwnership: async (userId) => {
        const { data } = await supabase
          .from('profiles')
          .select('owns_john_frutiger, owns_golden_hour, owns_master')
          .eq('id', userId)
          .single();
        if (data) {
          set({
            ownsJohnFrutiger: data.owns_john_frutiger ?? false,
            ownsGoldenHour: data.owns_golden_hour ?? false,
            ownsMaster: data.owns_master ?? false,
          });
        }
      },

      purchaseTheme: async (theme, userId) => {
        const col = theme === 'john-frutiger' ? 'owns_john_frutiger' : theme === 'golden-hour' ? 'owns_golden_hour' : 'owns_master';
        const { error } = await supabase
          .from('profiles')
          .update({ [col]: true })
          .eq('id', userId);
        if (error) return false;
        if (theme === 'john-frutiger') {
          set({ ownsJohnFrutiger: true });
        } else if (theme === 'golden-hour') {
          set({ ownsGoldenHour: true });
        } else {
          set({ ownsMaster: true });
        }
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
