// src/store/serverStore.ts
import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { loadPrivateKey, encryptMessage } from '../lib/crypto';
import type { Server, ServerMember, Bubble, ServerToolkit } from '../lib/serverTypes';

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
  bubbleUnreads: Record<string, number>;
  /** member user_ids per server (for online counts on cards) */
  serverMemberIds: Record<string, string[]>;
  activeToolkit: ServerToolkit | null;

  loadServers: () => Promise<void>;
  loadServerData: (serverId: string) => Promise<void>;
  loadAllServerMembers: () => Promise<void>;
  selectServer: (serverId: string | null) => void;
  selectBubble: (bubbleId: string | null) => void;
  setOnlineIds: (ids: Set<string>) => void;
  incrementUnread: (serverId: string) => void;
  clearUnread: (serverId: string) => void;
  incrementBubbleUnread: (bubbleId: string) => void;
  clearBubbleUnread: (bubbleId: string) => void;
  addServer: (server: Server) => void;
  removeServer: (serverId: string) => void;
  updateMembers: (members: ServerMember[]) => void;
  updateBubbles: (bubbles: Bubble[]) => void;
  subscribeBubbleUnreads: (userId: string, username: string) => () => void;
  seedBubbleUnreads: (userId: string) => Promise<void>;
  markBubbleRead: (bubbleId: string, userId: string) => void;
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
  bubbleUnreads: {},
  serverMemberIds: {},
  activeToolkit: null,

  loadServers: async () => {
    const { data } = await supabase
      .from('servers')
      .select('*')
      .order('created_at', { ascending: true });
    if (data) set({ servers: data });
  },

  loadServerData: async (serverId) => {
    const [membersRes, bubblesRes, toolkitRes] = await Promise.all([
      supabase
        .from('server_members')
        .select('*, profiles:user_id(username, avatar_url, status, card_gradient, card_image_url, card_image_params, bio, custom_status_text, custom_status_emoji, accent_color, accent_color_secondary, banner_gradient, banner_image_url, card_effect, avatar_gif_url, name_effect)')
        .eq('server_id', serverId),
      supabase
        .from('bubbles')
        .select('*')
        .eq('server_id', serverId)
        .order('created_at', { ascending: true }),
      supabase
        .from('server_toolkits')
        .select('*')
        .eq('server_id', serverId)
        .maybeSingle(),
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
      bio: m.profiles?.bio,
      custom_status_text: m.profiles?.custom_status_text,
      custom_status_emoji: m.profiles?.custom_status_emoji,
      accent_color: m.profiles?.accent_color,
      accent_color_secondary: m.profiles?.accent_color_secondary,
      banner_gradient: m.profiles?.banner_gradient,
      banner_image_url: m.profiles?.banner_image_url,
      card_effect: m.profiles?.card_effect,
      avatar_gif_url: m.profiles?.avatar_gif_url,
      name_effect: m.profiles?.name_effect,
    }));
    set({
      members,
      bubbles: bubblesRes.data ?? [],
      activeToolkit: toolkitRes.data ?? null,
    });
  },

  selectServer: (serverId) => set({ selectedServerId: serverId, selectedBubbleId: null }),
  selectBubble: (bubbleId) => {
    set({ selectedBubbleId: bubbleId });
    if (bubbleId) {
      get().clearBubbleUnread(bubbleId);
      // Persist read position — fire-and-forget
      supabase.auth.getUser().then(({ data }) => {
        if (data?.user) get().markBubbleRead(bubbleId, data.user.id);
      });
    }
  },
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

  incrementBubbleUnread: (bubbleId) => set(s => ({
    bubbleUnreads: { ...s.bubbleUnreads, [bubbleId]: (s.bubbleUnreads[bubbleId] ?? 0) + 1 },
  })),

  clearBubbleUnread: (bubbleId) => set(s => {
    const { [bubbleId]: _, ...rest } = s.bubbleUnreads;
    return { bubbleUnreads: rest };
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

  subscribeBubbleUnreads: (userId, username) => {
    // Listen for new bubble_messages across ALL bubbles in the user's servers.
    const channel = supabase
      .channel(`server-unreads:${userId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'bubble_messages',
      }, (payload) => {
        const msg = payload.new as { id: string; bubble_id: string; sender_id: string; content: string };
        if (msg.sender_id === userId) return;

        (async () => {
          const { data: bubble } = await supabase
            .from('bubbles')
            .select('server_id, name')
            .eq('id', msg.bubble_id)
            .single();
          if (!bubble) return;
          const s = get();

          // Increment bubble-level unread (unless viewing that bubble)
          if (s.selectedBubbleId !== msg.bubble_id) {
            get().incrementBubbleUnread(msg.bubble_id);
          }
          // Increment server-level unread only if not viewing that server
          if (s.selectedServerId !== bubble.server_id) {
            get().incrementUnread(bubble.server_id);
          }

          // ── Mention detection ──────────────────────────────────────
          if (username) {
            const mentionRegex = /@(\w+)/g;
            let m;
            while ((m = mentionRegex.exec(msg.content)) !== null) {
              if (m[1].toLowerCase() === username.toLowerCase()) {
                // Resolve sender username
                const { data: senderProfile } = await supabase
                  .from('profiles').select('username').eq('id', msg.sender_id).single();
                const senderName = senderProfile?.username ?? 'Someone';
                const serverName = s.servers.find(sv => sv.id === bubble.server_id)?.name ?? 'a server';

                // OS notification when app is not focused
                if (!document.hasFocus()) {
                  if ('Notification' in window && Notification.permission === 'granted') {
                    new Notification(`@${senderName} mentioned you`, {
                      body: `${serverName} · #${bubble.name}: ${msg.content.slice(0, 80)}`,
                      icon: '/icons/icon.png',
                      silent: false,
                    });
                  }
                }

                // In-app popup
                window.dispatchEvent(new CustomEvent('aero:mention', {
                  detail: {
                    senderUsername: senderName,
                    bubbleName: bubble.name,
                    serverName,
                    content: msg.content.slice(0, 100),
                    serverId: bubble.server_id,
                    bubbleId: msg.bubble_id,
                  },
                }));
                break;
              }
            }
          }
        })();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  },

  seedBubbleUnreads: async (userId) => {
    // For each bubble the user has access to, count messages after their last_read_at
    const { data: readRows } = await supabase
      .from('bubble_read_status')
      .select('bubble_id, last_read_at')
      .eq('user_id', userId);

    const readMap = new Map<string, string>();
    for (const row of readRows ?? []) {
      readMap.set(row.bubble_id, row.last_read_at);
    }

    // Get all bubbles from the user's servers
    const servers = get().servers;
    if (servers.length === 0) return;
    const { data: allBubbles } = await supabase
      .from('bubbles')
      .select('id, server_id')
      .in('server_id', servers.map(s => s.id));
    if (!allBubbles || allBubbles.length === 0) return;

    const bubbleUnreads: Record<string, number> = {};
    const serverUnreadTotals: Record<string, number> = {};

    // Query unread counts per bubble in parallel (batched)
    const results = await Promise.all(
      allBubbles.map(async (b) => {
        const lastRead = readMap.get(b.id);
        let query = supabase
          .from('bubble_messages')
          .select('id', { count: 'exact', head: true })
          .eq('bubble_id', b.id)
          .neq('sender_id', userId);
        if (lastRead) {
          query = query.gt('created_at', lastRead);
        }
        const { count } = await query;
        return { bubbleId: b.id, serverId: b.server_id, count: count ?? 0 };
      })
    );

    for (const { bubbleId, serverId, count } of results) {
      if (count > 0) {
        bubbleUnreads[bubbleId] = count;
        serverUnreadTotals[serverId] = (serverUnreadTotals[serverId] ?? 0) + count;
      }
    }

    set({ bubbleUnreads, serverUnreads: serverUnreadTotals });
  },

  markBubbleRead: (bubbleId, userId) => {
    supabase
      .from('bubble_read_status')
      .upsert({ user_id: userId, bubble_id: bubbleId, last_read_at: new Date().toISOString() }, { onConflict: 'user_id,bubble_id' })
      .then(({ error }) => { if (error) console.error('[markBubbleRead]', error); });
  },

  reset: () => set({
    servers: [], members: [], bubbles: [],
    selectedServerId: null, selectedBubbleId: null,
    onlineIds: new Set(), serverUnreads: {}, bubbleUnreads: {},
    serverMemberIds: {},
    activeToolkit: null,
  }),
}));
