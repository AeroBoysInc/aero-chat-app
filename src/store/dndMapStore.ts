// src/store/dndMapStore.ts
import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import type { DndMap, DndMapPin, DndMapVisibility } from '../lib/serverTypes';
import type { RealtimeChannel } from '@supabase/supabase-js';

interface DndMapStoreState {
  maps: DndMap[];
  visibleMaps: DndMap[];
  pins: Record<string, DndMapPin[]>;
  visibility: DndMapVisibility[];
  activeMapId: string | null;
  loading: boolean;

  loadMaps: (serverId: string, userId: string, isDm: boolean, userRoleIds: string[]) => Promise<void>;
  loadPins: (mapId: string) => Promise<void>;
  createMap: (data: { server_id: string; name: string; image_url: string; created_by: string }) => Promise<{ error?: string }>;
  updateMap: (id: string, fields: Partial<DndMap>) => Promise<{ error?: string }>;
  deleteMap: (id: string) => Promise<{ error?: string }>;
  reorderMaps: (orderedIds: string[]) => Promise<void>;

  createPin: (data: Omit<DndMapPin, 'id' | 'created_at'>) => Promise<{ error?: string }>;
  updatePin: (id: string, fields: Partial<DndMapPin>) => Promise<{ error?: string }>;
  deletePin: (id: string) => Promise<{ error?: string }>;

  setVisibility: (mapId: string, entries: { target_type: 'role' | 'member'; target_id: string }[]) => Promise<{ error?: string }>;

  setActiveMap: (mapId: string) => void;
  subscribeRealtime: (serverId: string) => () => void;
  reset: () => void;
}

function filterVisibleMaps(
  maps: DndMap[],
  visibility: DndMapVisibility[],
  userId: string,
  isDm: boolean,
  userRoleIds: string[],
): DndMap[] {
  if (isDm) return maps;
  return maps.filter(m => {
    const rows = visibility.filter(v => v.map_id === m.id);
    if (rows.length === 0) return true; // public
    return rows.some(r =>
      (r.target_type === 'member' && r.target_id === userId) ||
      (r.target_type === 'role' && userRoleIds.includes(r.target_id))
    );
  });
}

export const useDndMapStore = create<DndMapStoreState>()((set, get) => {
  let mapsChannel: RealtimeChannel | null = null;
  let pinsChannel: RealtimeChannel | null = null;

  return {
    maps: [],
    visibleMaps: [],
    pins: {},
    visibility: [],
    activeMapId: null,
    loading: false,

    loadMaps: async (serverId, userId, isDm, userRoleIds) => {
      set({ loading: true });

      try {
        // Fetch maps first, then visibility (needs map IDs)
        const { data: maps } = await supabase
          .from('dnd_maps')
          .select('*')
          .eq('server_id', serverId)
          .order('sort_order', { ascending: true });

        const allMaps = (maps ?? []) as DndMap[];
        const mapIds = allMaps.map(m => m.id);
        let allVis: DndMapVisibility[] = [];
        if (mapIds.length > 0) {
          const { data: visData } = await supabase
            .from('dnd_map_visibility')
            .select('*')
            .in('map_id', mapIds);
          allVis = (visData ?? []) as DndMapVisibility[];
        }

        const visible = filterVisibleMaps(allMaps, allVis, userId, isDm, userRoleIds);
        const activeId = get().activeMapId;
        const newActiveId = visible.find(m => m.id === activeId)?.id ?? visible[0]?.id ?? null;

        set({
          maps: allMaps,
          visibility: allVis,
          visibleMaps: visible,
          activeMapId: newActiveId,
        });

        // Load pins for the active map
        if (newActiveId) {
          get().loadPins(newActiveId);
        }
      } finally {
        set({ loading: false });
      }
    },

    loadPins: async (mapId) => {
      const { data } = await supabase
        .from('dnd_map_pins')
        .select('*')
        .eq('map_id', mapId)
        .order('created_at', { ascending: true });
      set(s => ({
        pins: { ...s.pins, [mapId]: (data ?? []) as DndMapPin[] },
      }));
    },

    createMap: async (data) => {
      const { error } = await supabase.from('dnd_maps').insert(data);
      if (error) return { error: error.message };
      return {};
    },

    updateMap: async (id, fields) => {
      const { error } = await supabase.from('dnd_maps').update(fields).eq('id', id);
      if (error) return { error: error.message };
      return {};
    },

    deleteMap: async (id) => {
      const { error } = await supabase.from('dnd_maps').delete().eq('id', id);
      if (error) return { error: error.message };
      set(s => {
        const newPins = { ...s.pins };
        delete newPins[id];
        const newMaps = s.maps.filter(m => m.id !== id);
        const newVisible = s.visibleMaps.filter(m => m.id !== id);
        const newActive = s.activeMapId === id ? (newVisible[0]?.id ?? null) : s.activeMapId;
        return { maps: newMaps, visibleMaps: newVisible, pins: newPins, activeMapId: newActive };
      });
      return {};
    },

    reorderMaps: async (orderedIds) => {
      const updates = orderedIds.map((id, i) =>
        supabase.from('dnd_maps').update({ sort_order: i }).eq('id', id)
      );
      await Promise.all(updates);
      set(s => ({
        maps: [...s.maps].sort((a, b) => orderedIds.indexOf(a.id) - orderedIds.indexOf(b.id)),
        visibleMaps: [...s.visibleMaps].sort((a, b) => orderedIds.indexOf(a.id) - orderedIds.indexOf(b.id)),
      }));
    },

    createPin: async (data) => {
      const { error } = await supabase.from('dnd_map_pins').insert(data);
      if (error) return { error: error.message };
      return {};
    },

    updatePin: async (id, fields) => {
      const { error } = await supabase.from('dnd_map_pins').update(fields).eq('id', id);
      if (error) return { error: error.message };
      return {};
    },

    deletePin: async (id) => {
      const { error } = await supabase.from('dnd_map_pins').delete().eq('id', id);
      if (error) return { error: error.message };
      // Optimistic removal
      set(s => {
        const newPins: Record<string, DndMapPin[]> = {};
        for (const [mapId, arr] of Object.entries(s.pins)) {
          newPins[mapId] = arr.filter(p => p.id !== id);
        }
        return { pins: newPins };
      });
      return {};
    },

    setVisibility: async (mapId, entries) => {
      // Delete all existing rows for this map, then insert new ones
      const { error: delErr } = await supabase
        .from('dnd_map_visibility')
        .delete()
        .eq('map_id', mapId);
      if (delErr) return { error: delErr.message };

      if (entries.length > 0) {
        const rows = entries.map(e => ({ map_id: mapId, ...e }));
        const { error: insErr } = await supabase.from('dnd_map_visibility').insert(rows);
        if (insErr) return { error: insErr.message };
      }

      // Re-fetch visibility
      const { data: allVis } = await supabase
        .from('dnd_map_visibility')
        .select('*')
        .in('map_id', get().maps.map(m => m.id));
      set({ visibility: (allVis ?? []) as DndMapVisibility[] });
      return {};
    },

    setActiveMap: (mapId) => {
      set({ activeMapId: mapId });
      // Load pins if not yet loaded
      if (!get().pins[mapId]) {
        get().loadPins(mapId);
      }
    },

    subscribeRealtime: (serverId) => {
      if (mapsChannel) { supabase.removeChannel(mapsChannel); mapsChannel = null; }
      if (pinsChannel) { supabase.removeChannel(pinsChannel); pinsChannel = null; }

      mapsChannel = supabase
        .channel(`dnd-maps:${serverId}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'dnd_maps', filter: `server_id=eq.${serverId}` },
          (payload) => {
            const { eventType } = payload;
            if (eventType === 'INSERT') {
              const newMap = payload.new as DndMap;
              set(s => {
                if (s.maps.some(m => m.id === newMap.id)) return s;
                const maps = [...s.maps, newMap];
                return { maps, visibleMaps: maps }; // Re-filtering happens on next loadMaps
              });
            } else if (eventType === 'UPDATE') {
              const updated = payload.new as DndMap;
              set(s => ({
                maps: s.maps.map(m => m.id === updated.id ? updated : m),
                visibleMaps: s.visibleMaps.map(m => m.id === updated.id ? updated : m),
              }));
            } else if (eventType === 'DELETE') {
              const old = payload.old as { id: string };
              set(s => {
                const maps = s.maps.filter(m => m.id !== old.id);
                const visibleMaps = s.visibleMaps.filter(m => m.id !== old.id);
                const newPins = { ...s.pins };
                delete newPins[old.id];
                const activeMapId = s.activeMapId === old.id ? (visibleMaps[0]?.id ?? null) : s.activeMapId;
                return { maps, visibleMaps, pins: newPins, activeMapId };
              });
            }
          }
        )
        .subscribe();

      pinsChannel = supabase
        .channel(`dnd-pins:${serverId}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'dnd_map_pins' },
          (payload) => {
            const { eventType } = payload;
            const mapIds = new Set(get().maps.map(m => m.id));

            if (eventType === 'INSERT') {
              const pin = payload.new as DndMapPin;
              if (!mapIds.has(pin.map_id)) return;
              set(s => {
                const existing = s.pins[pin.map_id] ?? [];
                if (existing.some(p => p.id === pin.id)) return s;
                return { pins: { ...s.pins, [pin.map_id]: [...existing, pin] } };
              });
            } else if (eventType === 'UPDATE') {
              const pin = payload.new as DndMapPin;
              if (!mapIds.has(pin.map_id)) return;
              set(s => ({
                pins: {
                  ...s.pins,
                  [pin.map_id]: (s.pins[pin.map_id] ?? []).map(p => p.id === pin.id ? pin : p),
                },
              }));
            } else if (eventType === 'DELETE') {
              const old = payload.old as { id: string; map_id?: string };
              set(s => {
                const newPins: Record<string, DndMapPin[]> = {};
                for (const [mapId, arr] of Object.entries(s.pins)) {
                  newPins[mapId] = arr.filter(p => p.id !== old.id);
                }
                return { pins: newPins };
              });
            }
          }
        )
        .subscribe();

      return () => {
        if (mapsChannel) { supabase.removeChannel(mapsChannel); mapsChannel = null; }
        if (pinsChannel) { supabase.removeChannel(pinsChannel); pinsChannel = null; }
      };
    },

    reset: () => {
      if (mapsChannel) { supabase.removeChannel(mapsChannel); mapsChannel = null; }
      if (pinsChannel) { supabase.removeChannel(pinsChannel); pinsChannel = null; }
      set({ maps: [], visibleMaps: [], pins: {}, visibility: [], activeMapId: null, loading: false });
    },
  };
});
