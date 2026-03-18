import { create } from 'zustand';
import { supabase } from '../lib/supabase';

export interface Profile {
  id: string;
  username: string;
  public_key: string;
  avatar_url?: string | null;
  status?: string | null;
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
      .select('id, username, public_key, avatar_url, status')
      .eq('id', user.id)
      .single();
    if (data) set({ user: data });
  },
  signOut: async () => {
    await supabase.auth.signOut();
    localStorage.removeItem('aero_private_key');
    set({ user: null });
  },
}));
