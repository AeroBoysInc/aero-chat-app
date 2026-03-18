import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import type { Profile } from './authStore';

export interface FriendRequest {
  id: string;
  sender_id: string;
  receiver_id: string;
  status: 'pending' | 'accepted' | 'declined';
  created_at: string;
  sender?: Profile;
  receiver?: Profile;
}

interface FriendState {
  friends:         Profile[];
  pendingIncoming: FriendRequest[];
  pendingSent:     FriendRequest[];
  loading:         boolean;
  loadFriends:          (userId: string) => Promise<void>;
  sendFriendRequest:    (senderId: string, receiverId: string) => Promise<string | null>;
  respondToRequest:     (requestId: string, accept: boolean) => Promise<void>;
  subscribeToRequests:  (userId: string) => () => void;
}

export const useFriendStore = create<FriendState>((set, get) => ({
  friends:         [],
  pendingIncoming: [],
  pendingSent:     [],
  loading:         false,

  loadFriends: async (userId) => {
    set({ loading: true });

    // Accepted requests (both directions)
    const { data: accepted } = await supabase
      .from('friend_requests')
      .select('*, sender:profiles!sender_id(id,username,public_key,avatar_url), receiver:profiles!receiver_id(id,username,public_key,avatar_url)')
      .eq('status', 'accepted')
      .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`);

    const friends: Profile[] = (accepted ?? []).map((r: any) =>
      r.sender_id === userId ? r.receiver : r.sender
    ).filter(Boolean);

    // Pending incoming
    const { data: incoming } = await supabase
      .from('friend_requests')
      .select('*, sender:profiles!sender_id(id,username,public_key,avatar_url)')
      .eq('receiver_id', userId)
      .eq('status', 'pending');

    // Pending sent
    const { data: sent } = await supabase
      .from('friend_requests')
      .select('*, receiver:profiles!receiver_id(id,username,public_key,avatar_url)')
      .eq('sender_id', userId)
      .eq('status', 'pending');

    set({
      friends,
      pendingIncoming: (incoming ?? []) as FriendRequest[],
      pendingSent:     (sent ?? []) as FriendRequest[],
      loading:         false,
    });
  },

  sendFriendRequest: async (senderId, receiverId) => {
    const { data, error } = await supabase
      .from('friend_requests')
      .insert({ sender_id: senderId, receiver_id: receiverId })
      .select()
      .single();
    if (error) return error.message;
    set((s) => ({ pendingSent: [...s.pendingSent, data as FriendRequest] }));
    return null;
  },

  respondToRequest: async (requestId, accept) => {
    const status = accept ? 'accepted' : 'declined';
    await supabase
      .from('friend_requests')
      .update({ status })
      .eq('id', requestId);

    if (accept) {
      // Move from pending to friends
      const req = get().pendingIncoming.find((r) => r.id === requestId);
      if (req?.sender) {
        set((s) => ({
          friends:         [...s.friends, req.sender!],
          pendingIncoming: s.pendingIncoming.filter((r) => r.id !== requestId),
        }));
      }
    } else {
      set((s) => ({
        pendingIncoming: s.pendingIncoming.filter((r) => r.id !== requestId),
      }));
    }
  },

  subscribeToRequests: (userId) => {
    const channel = supabase
      .channel(`friend_requests:${userId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'friend_requests',
        filter: `receiver_id=eq.${userId}`,
      }, () => {
        get().loadFriends(userId);
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'friend_requests',
        filter: `sender_id=eq.${userId}`,
      }, () => {
        get().loadFriends(userId);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  },
}));
