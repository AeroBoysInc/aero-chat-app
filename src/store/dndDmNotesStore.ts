// src/store/dndDmNotesStore.ts
import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import type { DndDmNote } from '../lib/serverTypes';

interface DndDmNotesStoreState {
  notes: DndDmNote[];
  loading: boolean;

  loadNotes: (serverId: string) => Promise<void>;
  createNote: (data: { server_id: string; created_by: string; title?: string }) => Promise<{ error?: string; note?: DndDmNote }>;
  updateNote: (id: string, fields: Partial<DndDmNote>) => Promise<{ error?: string }>;
  deleteNote: (id: string) => Promise<{ error?: string }>;
  reorderNotes: (orderedIds: string[]) => Promise<void>;
  reset: () => void;
}

export const useDndDmNotesStore = create<DndDmNotesStoreState>()((set, get) => ({
  notes: [],
  loading: false,

  loadNotes: async (serverId) => {
    set({ loading: true });
    try {
      const { data } = await supabase
        .from('dnd_dm_notes')
        .select('*')
        .eq('server_id', serverId)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true });
      set({ notes: (data ?? []) as DndDmNote[] });
    } finally {
      set({ loading: false });
    }
  },

  createNote: async (data) => {
    const maxOrder = Math.max(-1, ...get().notes.map(n => n.sort_order));
    const { data: inserted, error } = await supabase
      .from('dnd_dm_notes')
      .insert({
        server_id: data.server_id,
        created_by: data.created_by,
        title: data.title ?? 'Untitled',
        sort_order: maxOrder + 1,
      })
      .select()
      .single();
    if (error) return { error: error.message };
    const note = inserted as DndDmNote;
    set(s => ({ notes: [...s.notes, note] }));
    return { note };
  },

  updateNote: async (id, fields) => {
    const prev = get().notes;
    const nextFields = { ...fields, updated_at: new Date().toISOString() };
    set(s => ({ notes: s.notes.map(n => n.id === id ? { ...n, ...nextFields } : n) }));
    const { error } = await supabase
      .from('dnd_dm_notes')
      .update({ ...fields, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) {
      set({ notes: prev });
      return { error: error.message };
    }
    return {};
  },

  deleteNote: async (id) => {
    const prev = get().notes;
    set(s => ({ notes: s.notes.filter(n => n.id !== id) }));
    const { error } = await supabase.from('dnd_dm_notes').delete().eq('id', id);
    if (error) {
      set({ notes: prev });
      return { error: error.message };
    }
    return {};
  },

  reorderNotes: async (orderedIds) => {
    set(s => ({
      notes: [...s.notes].sort((a, b) => {
        const ai = orderedIds.indexOf(a.id);
        const bi = orderedIds.indexOf(b.id);
        if (ai === -1 && bi === -1) return 0;
        if (ai === -1) return 1;
        if (bi === -1) return -1;
        return ai - bi;
      }),
    }));
    const updates = orderedIds.map((id, i) =>
      supabase.from('dnd_dm_notes').update({ sort_order: i }).eq('id', id)
    );
    await Promise.all(updates);
  },

  reset: () => set({ notes: [], loading: false }),
}));
