// src/store/serverStore.ts
import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { loadPrivateKey, encryptMessage } from '../lib/crypto';
import type { Server, ServerMember, Bubble } from '../lib/serverTypes';

// ── Server invite message helper ─────────────────────────────────────────────

/**
 * Send an encrypted server-invite DM to a friend.
 * Content is JSON with `_serverInvite: true` so ChatWindow renders it as a card.
 */
export async function insertServerInviteMessage(
  senderId: string,
  recipientId: string,
  server: { id: string; name: string; description: string | null; icon_url: string | null; banner_url: string | null; member_count: number },
) {
  try {
    const privateKey = loadPrivateKey(senderId);
    if (!privateKey) { console.warn('[ServerInvite] No private key for sender', senderId); return; }

    const { data: profile } = await supabase
      .from('profiles').select('public_key').eq('id', recipientId).single();
    if (!profile?.public_key) { console.warn('[ServerInvite] No public key for recipient', recipientId); return; }

    const content = JSON.stringify({
      _serverInvite: true,
      serverId: server.id,
      name: server.name,
      description: server.description ?? '',
      iconUrl: server.icon_url ?? '',
      bannerUrl: server.banner_url ?? '',
      memberCount: server.member_count,
    });

    const ciphertext = encryptMessage(content, profile.public_key, privateKey);
    const { error } = await supabase.from('messages').insert({
      sender_id: senderId,
      recipient_id: recipientId,
      content: ciphertext,
    });
    if (error) console.error('[ServerInvite] Failed to insert message:', error);
  } catch (err) {
    console.error('[ServerInvite] Error sending invite message:', err);
  }
}

interface ServerStoreState {
  servers: Server[];
  members: ServerMember[];
  bubbles: Bubble[];
  selectedServerId: string | null;
  selectedBubbleId: string | null;
  onlineIds: Set<string>;
  serverUnreads: Record<string, number>;
  /** member user_ids per server (for online counts on cards) */
  serverMemberIds: Record<string, string[]>;

  loadServers: () => Promise<void>;
  loadServerData: (serverId: string) => Promise<void>;
  loadAllServerMembers: () => Promise<void>;
  selectServer: (serverId: string | null) => void;
  selectBubble: (bubbleId: string | null) => void;
  setOnlineIds: (ids: Set<string>) => void;
  incrementUnread: (serverId: string) => void;
  clearUnread: (serverId: string) => void;
  addServer: (server: Server) => void;
  removeServer: (serverId: string) => void;
  updateMembers: (members: ServerMember[]) => void;
  updateBubbles: (bubbles: Bubble[]) => void;
  subscribeBubbleUnreads: (userId: string) => () => void;
  reset: () => void;
}

export const useServerStore = create<ServerStoreState>()((set, get) => ({
  servers: [],
  members: [],
  bubbles: [],
  selectedServerId: null,
  selectedBubbleId: null,
  onlineIds: new Set(),
  serverUnreads: {},
  serverMemberIds: {},

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
        .select('*, profiles:user_id(username, avatar_url, status, card_gradient, card_image_url, card_image_params)')
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
      status: m.profiles?.status,
      card_gradient: m.profiles?.card_gradient,
      card_image_url: m.profiles?.card_image_url,
      card_image_params: m.profiles?.card_image_params,
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

  loadAllServerMembers: async () => {
    const servers = get().servers;
    if (servers.length === 0) return;
    const { data } = await supabase
      .from('server_members')
      .select('server_id, user_id')
      .in('server_id', servers.map(s => s.id));
    if (!data) return;
    const map: Record<string, string[]> = {};
    for (const row of data) {
      (map[row.server_id] ??= []).push(row.user_id);
    }
    set({ serverMemberIds: map });
  },

  subscribeBubbleUnreads: (userId) => {
    // Listen for new bubble_messages across ALL bubbles in the user's servers.
    // When a message arrives for a server the user is NOT currently viewing, increment unread.
    const channel = supabase
      .channel(`server-unreads:${userId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'bubble_messages',
      }, (payload) => {
        const msg = payload.new as { bubble_id: string; sender_id: string };
        if (msg.sender_id === userId) return; // own messages don't count

        (async () => {
          const { data: bubble } = await supabase
            .from('bubbles')
            .select('server_id')
            .eq('id', msg.bubble_id)
            .single();
          if (!bubble) return;
          // Don't increment if user is currently viewing this server
          if (get().selectedServerId === bubble.server_id) return;
          get().incrementUnread(bubble.server_id);
        })();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  },

  reset: () => set({
    servers: [], members: [], bubbles: [],
    selectedServerId: null, selectedBubbleId: null,
    onlineIds: new Set(), serverUnreads: {},
    serverMemberIds: {},
  }),
}));
