// src/store/dndQuestStore.ts
import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import type { DndQuest } from '../lib/serverTypes';
import type { RealtimeChannel } from '@supabase/supabase-js';

interface DndQuestStoreState {
  quests: DndQuest[];
  loading: boolean;

  loadQuests: (serverId: string) => Promise<void>;
  createQuest: (data: {
    server_id: string;
    title: string;
    description?: string;
    is_secret?: boolean;
    secret_player_ids?: string[];
    created_by: string;
  }) => Promise<{ error?: string }>;
  updateQuest: (id: string, fields: Partial<DndQuest>) => Promise<{ error?: string }>;
  deleteQuest: (id: string) => Promise<{ error?: string }>;
  toggleCompleted: (id: string, isCompleted: boolean) => Promise<{ error?: string }>;
  reorderQuests: (orderedIds: string[]) => Promise<void>;
  subscribeRealtime: (serverId: string) => () => void;
  reset: () => void;
}

export const useDndQuestStore = create<DndQuestStoreState>()((set, get) => {
  let channel: RealtimeChannel | null = null;

  return {
    quests: [],
    loading: false,

    loadQuests: async (serverId) => {
      set({ loading: true });
      try {
        const { data } = await supabase
          .from('dnd_quests')
          .select('*')
          .eq('server_id', serverId)
          .order('sort_order', { ascending: true })
          .order('created_at', { ascending: true });
        set({ quests: (data ?? []) as DndQuest[] });
      } finally {
        set({ loading: false });
      }
    },

    createQuest: async (data) => {
      const maxOrder = Math.max(-1, ...get().quests.map(q => q.sort_order));
      const { error } = await supabase.from('dnd_quests').insert({
        ...data,
        sort_order: maxOrder + 1,
      });
      if (error) return { error: error.message };
      return {};
    },

    updateQuest: async (id, fields) => {
      const prev = get().quests;
      set(s => ({ quests: s.quests.map(q => q.id === id ? { ...q, ...fields } : q) }));
      const { error } = await supabase.from('dnd_quests').update(fields).eq('id', id);
      if (error) {
        set({ quests: prev });
        return { error: error.message };
      }
      return {};
    },

    deleteQuest: async (id) => {
      const prev = get().quests;
      set(s => ({ quests: s.quests.filter(q => q.id !== id) }));
      const { error } = await supabase.from('dnd_quests').delete().eq('id', id);
      if (error) {
        set({ quests: prev });
        return { error: error.message };
      }
      return {};
    },

    toggleCompleted: async (id, isCompleted) => {
      const fields: Partial<DndQuest> = {
        is_completed: isCompleted,
        completed_at: isCompleted ? new Date().toISOString() : null,
      };
      return get().updateQuest(id, fields);
    },

    reorderQuests: async (orderedIds) => {
      set(s => ({
        quests: [...s.quests].sort((a, b) => {
          const ai = orderedIds.indexOf(a.id);
          const bi = orderedIds.indexOf(b.id);
          if (ai === -1 && bi === -1) return 0;
          if (ai === -1) return 1;
          if (bi === -1) return -1;
          return ai - bi;
        }),
      }));
      const updates = orderedIds.map((id, i) =>
        supabase.from('dnd_quests').update({ sort_order: i }).eq('id', id)
      );
      await Promise.all(updates);
    },

    subscribeRealtime: (serverId) => {
      if (channel) { supabase.removeChannel(channel); channel = null; }

      channel = supabase
        .channel(`dnd-quests:${serverId}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'dnd_quests', filter: `server_id=eq.${serverId}` },
          (payload) => {
            const { eventType } = payload;
            if (eventType === 'INSERT') {
              const q = payload.new as DndQuest;
              set(s => s.quests.some(x => x.id === q.id) ? s : { quests: [...s.quests, q] });
            } else if (eventType === 'UPDATE') {
              const q = payload.new as DndQuest;
              set(s => ({ quests: s.quests.map(x => x.id === q.id ? q : x) }));
            } else if (eventType === 'DELETE') {
              const old = payload.old as { id: string };
              set(s => ({ quests: s.quests.filter(x => x.id !== old.id) }));
            }
          }
        )
        .subscribe();

      return () => {
        if (channel) { supabase.removeChannel(channel); channel = null; }
      };
    },

    reset: () => {
      if (channel) { supabase.removeChannel(channel); channel = null; }
      set({ quests: [], loading: false });
    },
  };
});
