// src/store/dndCharacterStore.ts
import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import type { DndCharacter } from '../lib/serverTypes';
import type { RealtimeChannel } from '@supabase/supabase-js';

interface DndCharacterStoreState {
  characters: DndCharacter[];
  loading: boolean;
  loadCharacters: (serverId: string) => Promise<void>;
  upsertCharacter: (char: Omit<DndCharacter, 'id' | 'created_at'>) => Promise<{ error?: string }>;
  updateCharacter: (id: string, fields: Partial<DndCharacter>) => Promise<{ error?: string }>;
  deleteCharacter: (id: string) => Promise<{ error?: string }>;
  subscribeRealtime: (serverId: string) => () => void;
  reset: () => void;
}

export const useDndCharacterStore = create<DndCharacterStoreState>()((set, get) => {
  let channel: RealtimeChannel | null = null;

  return {
    characters: [],
    loading: false,

    loadCharacters: async (serverId) => {
      set({ loading: true });
      const { data } = await supabase
        .from('dnd_characters')
        .select('*')
        .eq('server_id', serverId)
        .order('created_at', { ascending: true });
      set({ characters: data ?? [], loading: false });
    },

    upsertCharacter: async (char) => {
      const { error } = await supabase
        .from('dnd_characters')
        .upsert(char, { onConflict: 'server_id,user_id' });
      if (error) return { error: error.message };
      await get().loadCharacters(char.server_id);
      return {};
    },

    updateCharacter: async (id, fields) => {
      const { error } = await supabase
        .from('dnd_characters')
        .update(fields)
        .eq('id', id);
      if (error) return { error: error.message };
      set(s => ({
        characters: s.characters.map(c => c.id === id ? { ...c, ...fields } : c),
      }));
      return {};
    },

    deleteCharacter: async (id) => {
      const { error } = await supabase
        .from('dnd_characters')
        .delete()
        .eq('id', id);
      if (error) return { error: error.message };
      set(s => ({ characters: s.characters.filter(c => c.id !== id) }));
      return {};
    },

    subscribeRealtime: (serverId) => {
      if (channel) { supabase.removeChannel(channel); channel = null; }

      channel = supabase
        .channel(`dnd-chars:${serverId}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'dnd_characters', filter: `server_id=eq.${serverId}` },
          (payload) => {
            const { eventType } = payload;
            if (eventType === 'INSERT') {
              const newChar = payload.new as DndCharacter;
              set(s => {
                if (s.characters.some(c => c.id === newChar.id)) return s;
                return { characters: [...s.characters, newChar] };
              });
            } else if (eventType === 'UPDATE') {
              const updated = payload.new as DndCharacter;
              set(s => ({
                characters: s.characters.map(c => c.id === updated.id ? updated : c),
              }));
            } else if (eventType === 'DELETE') {
              const old = payload.old as { id: string };
              set(s => ({
                characters: s.characters.filter(c => c.id !== old.id),
              }));
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
      set({ characters: [], loading: false });
    },
  };
});
