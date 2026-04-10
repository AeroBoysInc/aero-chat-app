import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { loadPrivateKey } from '../lib/crypto';
import {
  generateGroupKey,
  encryptGroupKeyForAllMembers,
  encryptGroupKeyForMember,
  decryptGroupKey,
  type EncryptedKeyEntry,
} from '../lib/groupCrypto';
import type { Profile } from './authStore';

// ── Types ──────────────────────────────────────────────────────────────────

export interface GroupChat {
  id: string;
  name: string;
  leader_id: string;
  group_key_encrypted: Record<string, EncryptedKeyEntry>;
  card_gradient: string | null;
  card_image_url: string | null;
  card_image_params: { zoom: number; x: number; y: number } | null;
  created_at: string;
  members: GroupMember[];
}

export interface GroupMember {
  id: string;
  group_id: string;
  user_id: string;
  joined_at: string;
  profile?: Profile;
}

export interface GroupInvite {
  id: string;
  group_id: string;
  inviter_id: string;
  invitee_id: string;
  status: 'pending' | 'accepted' | 'declined';
  created_at: string;
  group?: { name: string };
  inviter?: Profile;
}

// ── Store ──────────────────────────────────────────────────────────────────

interface GroupChatStore {
  groups: GroupChat[];
  selectedGroupId: string | null;
  pendingInvites: GroupInvite[];
  groupKeys: Map<string, Uint8Array>; // groupId → decrypted symmetric key

  loadGroups: (userId: string) => Promise<void>;
  loadInvites: (userId: string) => Promise<void>;
  createGroup: (name: string, friendIds: string[], myUserId: string) => Promise<string | null>;
  acceptInvite: (inviteId: string, myUserId: string) => Promise<void>;
  declineInvite: (inviteId: string) => Promise<void>;
  leaveGroup: (groupId: string, myUserId: string) => Promise<void>;
  removeMember: (groupId: string, userId: string) => Promise<void>;
  selectGroup: (groupId: string | null) => void;
  updateGroupCard: (groupId: string, fields: Partial<Pick<GroupChat, 'name' | 'card_gradient' | 'card_image_url' | 'card_image_params'>>) => Promise<void>;
  decryptAndCacheKey: (group: GroupChat, myUserId: string) => void;
  addMemberAfterAccept: (groupId: string, inviteeId: string, inviteePublicKey: string) => Promise<void>;
}

export const useGroupChatStore = create<GroupChatStore>()((set, get) => ({
  groups: [],
  selectedGroupId: null,
  pendingInvites: [],
  groupKeys: new Map(),

  loadGroups: async (userId) => {
    // Fetch groups where user is a member
    const { data: memberRows } = await supabase
      .from('group_members')
      .select('group_id')
      .eq('user_id', userId);
    if (!memberRows || memberRows.length === 0) {
      set({ groups: [] });
      return;
    }

    const groupIds = memberRows.map(r => r.group_id);
    const { data: groups } = await supabase
      .from('group_chats')
      .select('*')
      .in('id', groupIds);
    if (!groups) return;

    // Fetch all members for these groups, with profile join
    const { data: allMembers } = await supabase
      .from('group_members')
      .select('*, profile:profiles(*)')
      .in('group_id', groupIds);

    const groupList: GroupChat[] = groups.map(g => ({
      ...g,
      group_key_encrypted: g.group_key_encrypted ?? {},
      members: (allMembers ?? [])
        .filter(m => m.group_id === g.id)
        .map(m => ({ ...m, profile: m.profile })),
    }));

    set({ groups: groupList });

    // Decrypt and cache keys for each group
    for (const g of groupList) {
      get().decryptAndCacheKey(g, userId);
    }
  },

  loadInvites: async (userId) => {
    const { data } = await supabase
      .from('group_invites')
      .select('*, group:group_chats(name), inviter:profiles!group_invites_inviter_id_fkey(*)')
      .eq('invitee_id', userId)
      .eq('status', 'pending');
    set({ pendingInvites: data ?? [] });
  },

  createGroup: async (name, friendIds, myUserId) => {
    const myPrivateKey = loadPrivateKey(myUserId);
    if (!myPrivateKey) return null;

    // Fetch public keys for all members (self + friends)
    const allIds = [myUserId, ...friendIds];
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, public_key')
      .in('id', allIds);
    if (!profiles) return null;

    // Generate group key
    const groupKey = generateGroupKey();

    // Encrypt group key only for the leader initially (friends haven't accepted yet)
    const myProfile = profiles.find(p => p.id === myUserId);
    if (!myProfile?.public_key) return null;

    const keyEncrypted = encryptGroupKeyForAllMembers(
      groupKey,
      [{ userId: myUserId, publicKey: myProfile.public_key }],
      myPrivateKey,
    );

    // Insert group
    const { data: group, error } = await supabase
      .from('group_chats')
      .insert({ name, leader_id: myUserId, group_key_encrypted: keyEncrypted })
      .select()
      .single();
    if (error || !group) return null;

    // Insert creator as first member
    await supabase.from('group_members').insert({ group_id: group.id, user_id: myUserId });

    // Insert invites for each friend
    for (const friendId of friendIds) {
      await supabase.from('group_invites').insert({
        group_id: group.id,
        inviter_id: myUserId,
        invitee_id: friendId,
      });
    }

    // Cache the key locally
    const keys = new Map(get().groupKeys);
    keys.set(group.id, groupKey);
    set({ groupKeys: keys });

    // Reload groups
    await get().loadGroups(myUserId);
    return group.id;
  },

  acceptInvite: async (inviteId, myUserId) => {
    await supabase
      .from('group_invites')
      .update({ status: 'accepted' })
      .eq('id', inviteId);

    // Remove from local pending
    set(s => ({ pendingInvites: s.pendingInvites.filter(i => i.id !== inviteId) }));
  },

  declineInvite: async (inviteId) => {
    await supabase
      .from('group_invites')
      .update({ status: 'declined' })
      .eq('id', inviteId);
    set(s => ({ pendingInvites: s.pendingInvites.filter(i => i.id !== inviteId) }));
  },

  leaveGroup: async (groupId, myUserId) => {
    const group = get().groups.find(g => g.id === groupId);
    if (!group) return;

    if (group.leader_id === myUserId) {
      // Transfer leadership to longest-tenured member
      const otherMembers = group.members
        .filter(m => m.user_id !== myUserId)
        .sort((a, b) => new Date(a.joined_at).getTime() - new Date(b.joined_at).getTime());

      if (otherMembers.length > 0) {
        await supabase
          .from('group_chats')
          .update({ leader_id: otherMembers[0].user_id })
          .eq('id', groupId);
      } else {
        // Last member — delete the group
        await supabase.from('group_chats').delete().eq('id', groupId);
        set(s => ({
          groups: s.groups.filter(g => g.id !== groupId),
          selectedGroupId: s.selectedGroupId === groupId ? null : s.selectedGroupId,
        }));
        return;
      }
    }

    // Remove self from members
    await supabase
      .from('group_members')
      .delete()
      .eq('group_id', groupId)
      .eq('user_id', myUserId);

    // Remove key entry
    if (group.group_key_encrypted[myUserId]) {
      const updated = { ...group.group_key_encrypted };
      delete updated[myUserId];
      await supabase
        .from('group_chats')
        .update({ group_key_encrypted: updated })
        .eq('id', groupId);
    }

    // Clean up local state
    const keys = new Map(get().groupKeys);
    keys.delete(groupId);
    set(s => ({
      groups: s.groups.filter(g => g.id !== groupId),
      selectedGroupId: s.selectedGroupId === groupId ? null : s.selectedGroupId,
      groupKeys: keys,
    }));
  },

  removeMember: async (groupId, userId) => {
    await supabase
      .from('group_members')
      .delete()
      .eq('group_id', groupId)
      .eq('user_id', userId);

    const group = get().groups.find(g => g.id === groupId);
    if (group?.group_key_encrypted[userId]) {
      const updated = { ...group.group_key_encrypted };
      delete updated[userId];
      await supabase
        .from('group_chats')
        .update({ group_key_encrypted: updated })
        .eq('id', groupId);
    }

    set(s => ({
      groups: s.groups.map(g =>
        g.id === groupId
          ? { ...g, members: g.members.filter(m => m.user_id !== userId) }
          : g
      ),
    }));
  },

  selectGroup: (groupId) => set({ selectedGroupId: groupId }),

  updateGroupCard: async (groupId, fields) => {
    await supabase.from('group_chats').update(fields).eq('id', groupId);
    set(s => ({
      groups: s.groups.map(g => g.id === groupId ? { ...g, ...fields } : g),
    }));
  },

  decryptAndCacheKey: (group, myUserId) => {
    if (get().groupKeys.has(group.id)) return;
    const myEntry = group.group_key_encrypted[myUserId];
    if (!myEntry) return;

    const myPrivateKey = loadPrivateKey(myUserId);
    if (!myPrivateKey) return;

    const leaderMember = group.members.find(m => m.user_id === group.leader_id);
    const leaderPublicKey = leaderMember?.profile?.public_key;
    if (!leaderPublicKey) return;

    const groupKey = decryptGroupKey(myEntry, leaderPublicKey, myPrivateKey);
    if (!groupKey) return;

    const keys = new Map(get().groupKeys);
    keys.set(group.id, groupKey);
    set({ groupKeys: keys });
  },

  addMemberAfterAccept: async (groupId, inviteeId, inviteePublicKey) => {
    const group = get().groups.find(g => g.id === groupId);
    if (!group) return;

    const groupKey = get().groupKeys.get(groupId);
    if (!groupKey) return;

    const myPrivateKey = loadPrivateKey(group.leader_id);
    if (!myPrivateKey) return;

    const newEntry = encryptGroupKeyForMember(groupKey, inviteePublicKey, myPrivateKey);
    const updatedKeys = { ...group.group_key_encrypted, [inviteeId]: newEntry };

    await supabase
      .from('group_chats')
      .update({ group_key_encrypted: updatedKeys })
      .eq('id', groupId);

    await supabase.from('group_members').insert({ group_id: groupId, user_id: inviteeId });

    // Reload to get updated member list
    const { user } = await import('./authStore').then(m => m.useAuthStore.getState());
    if (user) await get().loadGroups(user.id);
  },
}));
