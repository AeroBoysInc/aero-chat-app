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
  removeFriend:         (userId: string, friendId: string) => Promise<void>;
  subscribeToRequests:  (userId: string) => () => void;
}

export const useFriendStore = create<FriendState>((set, get) => ({
  friends:         [],
  pendingIncoming: [],
  pendingSent:     [],
  loading:         false,

  loadFriends: async (userId) => {
    set({ loading: true });

    const PROFILE_FIELDS = 'id,username,public_key,avatar_url,status,card_gradient,card_image_url,card_image_params,is_premium,bio,custom_status_text,custom_status_emoji,accent_color,accent_color_secondary,banner_gradient,banner_image_url,card_effect';

    // Accepted requests (both directions)
    const { data: accepted } = await supabase
      .from('friend_requests')
      .select(`*, sender:profiles!sender_id(${PROFILE_FIELDS}), receiver:profiles!receiver_id(${PROFILE_FIELDS})`)
      .eq('status', 'accepted')
      .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`);

    const friends: Profile[] = (accepted ?? []).map((r: any) =>
      r.sender_id === userId ? r.receiver : r.sender
    ).filter(Boolean);

    // Pending incoming
    const { data: incoming } = await supabase
      .from('friend_requests')
      .select(`*, sender:profiles!sender_id(${PROFILE_FIELDS})`)
      .eq('receiver_id', userId)
      .eq('status', 'pending');

    // Pending sent
    const { data: sent } = await supabase
      .from('friend_requests')
      .select(`*, receiver:profiles!receiver_id(${PROFILE_FIELDS})`)
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

  removeFriend: async (userId, friendId) => {
    await supabase
      .from('friend_requests')
      .delete()
      .or(
        `and(sender_id.eq.${userId},receiver_id.eq.${friendId}),` +
        `and(sender_id.eq.${friendId},receiver_id.eq.${userId})`
      );
    set(s => ({ friends: s.friends.filter(f => f.id !== friendId) }));
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

    // Separate channel: live status updates for any profile
    const profileChannel = supabase
      .channel(`profile_status:${userId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'profiles',
      }, (payload) => {
        const updated = payload.new as Profile;
        // Spread all fields so card changes (gradient, image) propagate live
        set(state => ({
          friends: state.friends.map(f =>
            f.id === updated.id ? { ...f, ...updated } : f
          ),
        }));
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(profileChannel);
    };
  },
}));

/** Get a friend's full profile including identity fields by ID. */
export function getFriendProfile(friendId: string): Profile | undefined {
  return useFriendStore.getState().friends.find(f => f.id === friendId);
}
