// src/store/serverStore.ts
import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import type { Server, ServerMember, Bubble } from '../lib/serverTypes';

interface ServerStoreState {
  servers: Server[];
  members: ServerMember[];
  bubbles: Bubble[];
  selectedServerId: string | null;
  selectedBubbleId: string | null;
  onlineIds: Set<string>;
  serverUnreads: Record<string, number>;

  loadServers: () => Promise<void>;
  loadServerData: (serverId: string) => Promise<void>;
  selectServer: (serverId: string | null) => void;
  selectBubble: (bubbleId: string | null) => void;
  setOnlineIds: (ids: Set<string>) => void;
  incrementUnread: (serverId: string) => void;
  clearUnread: (serverId: string) => void;
  addServer: (server: Server) => void;
  removeServer: (serverId: string) => void;
  updateMembers: (members: ServerMember[]) => void;
  updateBubbles: (bubbles: Bubble[]) => void;
  reset: () => void;
}

export const useServerStore = create<ServerStoreState>()((set, _get) => ({
  servers: [],
  members: [],
  bubbles: [],
  selectedServerId: null,
  selectedBubbleId: null,
  onlineIds: new Set(),
  serverUnreads: {},

  loadServers: async () => {
    const { data } = await supabase
      .from('servers')
      .select('*')
      .order('created_at', { ascending: true });
    if (data) set({ servers: data });
  },

  loadServerData: async (serverId) => {
    const [membersRes, bubblesRes] = await Promise.all([
      supabase
        .from('server_members')
        .select('*, profiles:user_id(username, avatar_url)')
        .eq('server_id', serverId),
      supabase
        .from('bubbles')
        .select('*')
        .eq('server_id', serverId)
        .order('created_at', { ascending: true }),
    ]);
    const members = (membersRes.data ?? []).map((m: any) => ({
      server_id: m.server_id,
      user_id: m.user_id,
      role_id: m.role_id,
      joined_at: m.joined_at,
      username: m.profiles?.username,
      avatar_url: m.profiles?.avatar_url,
    }));
    set({
      members,
      bubbles: bubblesRes.data ?? [],
    });
  },

  selectServer: (serverId) => set({ selectedServerId: serverId, selectedBubbleId: null }),
  selectBubble: (bubbleId) => set({ selectedBubbleId: bubbleId }),
  setOnlineIds: (ids) => set({ onlineIds: ids }),

  incrementUnread: (serverId) => set(s => ({
    serverUnreads: {
      ...s.serverUnreads,
      [serverId]: (s.serverUnreads[serverId] ?? 0) + 1,
    },
  })),

  clearUnread: (serverId) => set(s => {
    const { [serverId]: _, ...rest } = s.serverUnreads;
    return { serverUnreads: rest };
  }),

  addServer: (server) => set(s => ({ servers: [...s.servers, server] })),
  removeServer: (serverId) => set(s => ({
    servers: s.servers.filter(sv => sv.id !== serverId),
    selectedServerId: s.selectedServerId === serverId ? null : s.selectedServerId,
  })),
  updateMembers: (members) => set({ members }),
  updateBubbles: (bubbles) => set({ bubbles }),
  reset: () => set({
    servers: [], members: [], bubbles: [],
    selectedServerId: null, selectedBubbleId: null,
    onlineIds: new Set(), serverUnreads: {},
  }),
}));
