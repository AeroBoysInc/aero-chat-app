import { create } from 'zustand';
import { supabase } from '../lib/supabase';

export interface Profile {
  id: string;
  username: string;
  public_key: string;
}

interface AuthState {
  user:    Profile | null;
  loading: boolean;
  setUser: (user: Profile | null) => void;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user:    null,
  loading: true,
  setUser: (user) => set({ user, loading: false }),
  signOut: async () => {
    await supabase.auth.signOut();
    localStorage.removeItem('aero_private_key');
    set({ user: null });
  },
}));
