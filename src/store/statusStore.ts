import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase } from '../lib/supabase';
import type { Status } from '../components/ui/AvatarImage';

interface StatusStore {
  status: Status;
  showGameActivity: boolean;
  /** Change status locally and persist it to the profiles table */
  setStatus: (s: Status) => Promise<void>;
  /** Push the locally-stored status to Supabase (call on login) */
  syncToSupabase: (userId: string) => Promise<void>;
  setShowGameActivity: (val: boolean) => void;
}

export const useStatusStore = create<StatusStore>()(
  persist(
    (set, get) => ({
      status: 'online' as Status,
      showGameActivity: true,

      setStatus: async (status) => {
        set({ status });
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await supabase.from('profiles').update({ status }).eq('id', user.id);
        }
      },

      syncToSupabase: async (userId) => {
        const { status } = get();
        await supabase.from('profiles').update({ status }).eq('id', userId);
      },

      setShowGameActivity: (val) => set({ showGameActivity: val }),
    }),
    { name: 'aero-status' }
  )
);
