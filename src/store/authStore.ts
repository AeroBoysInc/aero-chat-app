import { create } from 'zustand';
import { supabase } from '../lib/supabase';

export interface Profile {
  id: string;
  username: string;
  public_key: string;
  avatar_url?: string | null;
  status?: string | null;
  card_gradient?: string | null;
  card_image_url?: string | null;
  card_image_params?: {
    zoom: number;
    x: number;
    y: number;
  } | null;
}

interface AuthState {
  user:           Profile | null;
  loading:        boolean;
  setUser:        (user: Profile | null) => void;
  refreshProfile: () => Promise<void>;
  signOut:        () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user:    null,
  loading: true,
  setUser: (user) => set({ user, loading: false }),
  refreshProfile: async () => {
    const { user } = get();
    if (!user) return;
    const { data } = await supabase
      .from('profiles')
      .select('id, username, public_key, avatar_url, status, card_gradient, card_image_url, card_image_params')
      .eq('id', user.id)
      .single();
    if (data) set({ user: data });
  },
  signOut: async () => {
    await supabase.auth.signOut();
    // Private keys are kept in localStorage intentionally — they're scoped to userId
    // and are needed to decrypt message history on next login. Removing them here
    // triggers key rotation on re-login, making all previous messages unreadable.
    set({ user: null });
  },
}));
