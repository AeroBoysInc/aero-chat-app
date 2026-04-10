# Group Chats Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add encrypted group chat functionality — create groups of up to 4, invite friends (must accept), text with E2E encryption via NaCl secretbox, customize group card, start group calls that ring all members.

**Architecture:** Four new Supabase tables (`group_chats`, `group_members`, `group_invites`, `group_messages`) with RLS. Shared symmetric key per group (NaCl secretbox) encrypted per-member with nacl.box. Two new Zustand stores (`groupChatStore`, `groupMessageStore`). Sidebar gets Friends/Groups pill tabs. New `GroupChatWindow` component mirrors `ChatWindow` for group context.

**Tech Stack:** React 19, Zustand, Supabase (Postgres + Realtime + Storage), TweetNaCl (nacl.box + nacl.secretbox), @tanstack/react-virtual, Lucide icons.

---

## File Structure

### New Files

| File | Responsibility |
|------|---------------|
| `supabase/migrations/031_group_chats.sql` | 4 tables + RLS + indexes + storage bucket |
| `src/lib/groupCrypto.ts` | Group key generation, per-member encryption, secretbox message encrypt/decrypt |
| `src/store/groupChatStore.ts` | Group CRUD, invites, member management, key cache |
| `src/store/groupMessageStore.ts` | Per-group message cache, send/receive/decrypt |
| `src/components/chat/GroupChatWindow.tsx` | Group chat UI (header, messages, input, call banner) |
| `src/components/chat/CreateGroupModal.tsx` | Group creation modal (name + friend multi-select) |
| `src/components/chat/GroupSettingsModal.tsx` | Leader settings (name, card, remove members) |

### Modified Files

| File | Changes |
|------|---------|
| `src/components/chat/Sidebar.tsx` | Friends/Groups pill tabs, GroupItem component, group list rendering |
| `src/components/chat/ChatLayout.tsx` | Route to `GroupChatWindow` when a group is selected |
| `src/store/chatStore.ts` | Add `selectedGroupId` alongside `selectedContact` |
| `src/App.tsx` | Subscribe to group-invites + group-messages realtime channels |
| `src/lib/notifications.ts` | Add `showGroupInviteNotification`, `showGroupMessageNotification` |
| `src/components/chat/FriendRequestModal.tsx` | Show group invites alongside friend requests |

---

## Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/031_group_chats.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- 031_group_chats.sql — Group chats: tables, RLS, indexes, storage

-- ═══════════════════════════════════════════════════════════════════
-- 1. group_chats — one row per group
-- ═══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS group_chats (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name                text NOT NULL,
  leader_id           uuid NOT NULL REFERENCES profiles(id),
  group_key_encrypted jsonb DEFAULT '{}'::jsonb,
  card_gradient       text,
  card_image_url      text,
  card_image_params   jsonb,
  created_at          timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE group_chats ENABLE ROW LEVEL SECURITY;

-- SELECT: user is a member
CREATE POLICY "group_chats_select" ON group_chats FOR SELECT USING (
  EXISTS (SELECT 1 FROM group_members gm WHERE gm.group_id = id AND gm.user_id = auth.uid())
);

-- INSERT: any authenticated user
CREATE POLICY "group_chats_insert" ON group_chats FOR INSERT WITH CHECK (
  auth.uid() IS NOT NULL
);

-- UPDATE: only leader
CREATE POLICY "group_chats_update" ON group_chats FOR UPDATE USING (
  leader_id = auth.uid()
);

-- DELETE: only leader
CREATE POLICY "group_chats_delete" ON group_chats FOR DELETE USING (
  leader_id = auth.uid()
);

-- ═══════════════════════════════════════════════════════════════════
-- 2. group_members — who's in each group
-- ═══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS group_members (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id   uuid NOT NULL REFERENCES group_chats(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES profiles(id),
  joined_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (group_id, user_id)
);

ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;

-- SELECT: user must be member of the group
CREATE POLICY "group_members_select" ON group_members FOR SELECT USING (
  EXISTS (SELECT 1 FROM group_members gm2 WHERE gm2.group_id = group_id AND gm2.user_id = auth.uid())
);

-- INSERT: only group leader can add members
CREATE POLICY "group_members_insert" ON group_members FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM group_chats gc WHERE gc.id = group_id AND gc.leader_id = auth.uid())
);

-- DELETE: user can remove self, leader can remove anyone
CREATE POLICY "group_members_delete" ON group_members FOR DELETE USING (
  user_id = auth.uid()
  OR EXISTS (SELECT 1 FROM group_chats gc WHERE gc.id = group_id AND gc.leader_id = auth.uid())
);

-- ═══════════════════════════════════════════════════════════════════
-- 3. group_invites — pending invitations
-- ═══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS group_invites (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id    uuid NOT NULL REFERENCES group_chats(id) ON DELETE CASCADE,
  inviter_id  uuid NOT NULL REFERENCES profiles(id),
  invitee_id  uuid NOT NULL REFERENCES profiles(id),
  status      text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (group_id, invitee_id)
);

ALTER TABLE group_invites ENABLE ROW LEVEL SECURITY;

-- SELECT: inviter or invitee
CREATE POLICY "group_invites_select" ON group_invites FOR SELECT USING (
  inviter_id = auth.uid() OR invitee_id = auth.uid()
);

-- INSERT: only group leader
CREATE POLICY "group_invites_insert" ON group_invites FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM group_chats gc WHERE gc.id = group_id AND gc.leader_id = auth.uid())
);

-- UPDATE: only invitee can change status
CREATE POLICY "group_invites_update" ON group_invites FOR UPDATE USING (
  invitee_id = auth.uid()
);

-- ═══════════════════════════════════════════════════════════════════
-- 4. group_messages — encrypted group messages
-- ═══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS group_messages (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id    uuid NOT NULL REFERENCES group_chats(id) ON DELETE CASCADE,
  sender_id   uuid NOT NULL REFERENCES profiles(id),
  content     text NOT NULL,
  nonce       text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_group_messages_group_created
  ON group_messages (group_id, created_at);

ALTER TABLE group_messages ENABLE ROW LEVEL SECURITY;

-- SELECT: user must be member
CREATE POLICY "group_messages_select" ON group_messages FOR SELECT USING (
  EXISTS (SELECT 1 FROM group_members gm WHERE gm.group_id = group_id AND gm.user_id = auth.uid())
);

-- INSERT: user must be member and sender_id matches
CREATE POLICY "group_messages_insert" ON group_messages FOR INSERT WITH CHECK (
  sender_id = auth.uid()
  AND EXISTS (SELECT 1 FROM group_members gm WHERE gm.group_id = group_id AND gm.user_id = auth.uid())
);

-- ═══════════════════════════════════════════════════════════════════
-- 5. Realtime — enable postgres_changes for new tables
-- ═══════════════════════════════════════════════════════════════════
ALTER PUBLICATION supabase_realtime ADD TABLE group_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE group_members;
ALTER PUBLICATION supabase_realtime ADD TABLE group_invites;

-- ═══════════════════════════════════════════════════════════════════
-- 6. Storage — group-images bucket
-- ═══════════════════════════════════════════════════════════════════
INSERT INTO storage.buckets (id, name, public) VALUES ('group-images', 'group-images', true)
ON CONFLICT (id) DO NOTHING;

-- RLS on storage: only group leader can upload/update/delete
CREATE POLICY "group_images_insert" ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'group-images'
  AND EXISTS (
    SELECT 1 FROM group_chats gc
    WHERE gc.id = (storage.foldername(name))[1]::uuid
    AND gc.leader_id = auth.uid()
  )
);

CREATE POLICY "group_images_update" ON storage.objects FOR UPDATE USING (
  bucket_id = 'group-images'
  AND EXISTS (
    SELECT 1 FROM group_chats gc
    WHERE gc.id = (storage.foldername(name))[1]::uuid
    AND gc.leader_id = auth.uid()
  )
);

CREATE POLICY "group_images_delete" ON storage.objects FOR DELETE USING (
  bucket_id = 'group-images'
  AND EXISTS (
    SELECT 1 FROM group_chats gc
    WHERE gc.id = (storage.foldername(name))[1]::uuid
    AND gc.leader_id = auth.uid()
  )
);

-- Public read for group images
CREATE POLICY "group_images_select" ON storage.objects FOR SELECT USING (
  bucket_id = 'group-images'
);
```

- [ ] **Step 2: Run the migration in Supabase SQL editor**

Open Supabase dashboard → SQL Editor → paste the migration → Execute.

Verify: check that all 4 tables exist in Table Editor, and `group-images` bucket appears in Storage.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/031_group_chats.sql
git commit -m "feat: add group_chats, group_members, group_invites, group_messages tables + RLS + storage"
```

---

## Task 2: Group Crypto Module

**Files:**
- Create: `src/lib/groupCrypto.ts`

This module handles: generating a group symmetric key, encrypting it for each member (using nacl.box), decrypting the group key, and encrypting/decrypting messages with nacl.secretbox.

- [ ] **Step 1: Create `src/lib/groupCrypto.ts`**

```ts
import * as nacl from 'tweetnacl';
import { encodeBase64, decodeBase64, decodeUTF8, encodeUTF8 } from 'tweetnacl-util';

// ── Group key generation ─────────────────────────────────────────────────────

/** Generate a random 32-byte NaCl secretbox key for a group. */
export function generateGroupKey(): Uint8Array {
  return nacl.randomBytes(nacl.secretbox.keyLength);
}

// ── Per-member key encryption (nacl.box — DH) ───────────────────────────────

export interface EncryptedKeyEntry {
  encrypted: string; // base64
  nonce: string;     // base64
}

/**
 * Encrypt the group symmetric key for a single member.
 * Uses nacl.box(groupKey, nonce, memberPublicKey, leaderPrivateKey).
 */
export function encryptGroupKeyForMember(
  groupKey: Uint8Array,
  memberPublicKeyB64: string,
  leaderPrivateKeyB64: string,
): EncryptedKeyEntry {
  const memberPub = decodeBase64(memberPublicKeyB64);
  const leaderPriv = decodeBase64(leaderPrivateKeyB64);
  const nonce = nacl.randomBytes(nacl.box.nonceLength);
  const encrypted = nacl.box(groupKey, nonce, memberPub, leaderPriv);
  return {
    encrypted: encodeBase64(encrypted),
    nonce: encodeBase64(nonce),
  };
}

/**
 * Build the full group_key_encrypted JSONB object for all members.
 * Returns { [userId]: { encrypted, nonce } }.
 */
export function encryptGroupKeyForAllMembers(
  groupKey: Uint8Array,
  members: { userId: string; publicKey: string }[],
  leaderPrivateKeyB64: string,
): Record<string, EncryptedKeyEntry> {
  const result: Record<string, EncryptedKeyEntry> = {};
  for (const m of members) {
    result[m.userId] = encryptGroupKeyForMember(groupKey, m.publicKey, leaderPrivateKeyB64);
  }
  return result;
}

/**
 * Decrypt the group symmetric key using my private key + leader's public key.
 * Returns the raw 32-byte key or null on failure.
 */
export function decryptGroupKey(
  entry: EncryptedKeyEntry,
  leaderPublicKeyB64: string,
  myPrivateKeyB64: string,
): Uint8Array | null {
  try {
    const encrypted = decodeBase64(entry.encrypted);
    const nonce = decodeBase64(entry.nonce);
    const leaderPub = decodeBase64(leaderPublicKeyB64);
    const myPriv = decodeBase64(myPrivateKeyB64);
    const decrypted = nacl.box.open(encrypted, nonce, leaderPub, myPriv);
    return decrypted;
  } catch {
    return null;
  }
}

// ── Message encryption (nacl.secretbox — symmetric) ──────────────────────────

/**
 * Encrypt a plaintext message with the group's shared symmetric key.
 * Returns { ciphertext: base64, nonce: base64 }.
 */
export function encryptGroupMessage(
  plaintext: string,
  groupKey: Uint8Array,
): { ciphertext: string; nonce: string } {
  const nonce = nacl.randomBytes(nacl.secretbox.nonceLength);
  const message = decodeUTF8(plaintext);
  const encrypted = nacl.secretbox(message, nonce, groupKey);
  return {
    ciphertext: encodeBase64(encrypted),
    nonce: encodeBase64(nonce),
  };
}

/**
 * Decrypt a group message with the shared symmetric key.
 * Returns plaintext string or null on failure.
 */
export function decryptGroupMessage(
  ciphertextB64: string,
  nonceB64: string,
  groupKey: Uint8Array,
): string | null {
  try {
    const ciphertext = decodeBase64(ciphertextB64);
    const nonce = decodeBase64(nonceB64);
    const decrypted = nacl.secretbox.open(ciphertext, nonce, groupKey);
    if (!decrypted) return null;
    return encodeUTF8(decrypted);
  } catch {
    return null;
  }
}
```

- [ ] **Step 2: Verify the module compiles**

Run: `cd aero-chat-app && npx tsc --noEmit src/lib/groupCrypto.ts`

- [ ] **Step 3: Commit**

```bash
git add src/lib/groupCrypto.ts
git commit -m "feat: add groupCrypto module — key gen, per-member encryption, secretbox messages"
```

---

## Task 3: Group Chat Store

**Files:**
- Create: `src/store/groupChatStore.ts`

This store manages group CRUD, invites, member management, and the decrypted key cache. It does NOT handle messages (that's `groupMessageStore`).

- [ ] **Step 1: Create `src/store/groupChatStore.ts`**

```ts
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
    // Check if user is the leader
    const group = get().groups.find(g => g.id === groupId);
    if (!group) return;

    if (group.leader_id === myUserId) {
      // Transfer leadership to longest-tenured member
      const otherMembers = group.members
        .filter(m => m.user_id !== myUserId)
        .sort((a, b) => new Date(a.joined_at).getTime() - new Date(b.joined_at).getTime());

      if (otherMembers.length > 0) {
        // Transfer leadership
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

    // Remove their key entry
    const group = get().groups.find(g => g.id === groupId);
    if (group?.group_key_encrypted[userId]) {
      const updated = { ...group.group_key_encrypted };
      delete updated[userId];
      await supabase
        .from('group_chats')
        .update({ group_key_encrypted: updated })
        .eq('id', groupId);
    }

    // Update local state
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
    if (get().groupKeys.has(group.id)) return; // already cached
    const myEntry = group.group_key_encrypted[myUserId];
    if (!myEntry) return;

    const myPrivateKey = loadPrivateKey(myUserId);
    if (!myPrivateKey) return;

    // Need the leader's public key to decrypt
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
    // Called by the leader's client when an invite is accepted
    const group = get().groups.find(g => g.id === groupId);
    if (!group) return;

    const groupKey = get().groupKeys.get(groupId);
    if (!groupKey) return;

    const myPrivateKey = loadPrivateKey(group.leader_id);
    if (!myPrivateKey) return;

    // Encrypt the group key for the new member
    const newEntry = encryptGroupKeyForMember(groupKey, inviteePublicKey, myPrivateKey);
    const updatedKeys = { ...group.group_key_encrypted, [inviteeId]: newEntry };

    // Update the encrypted keys in DB
    await supabase
      .from('group_chats')
      .update({ group_key_encrypted: updatedKeys })
      .eq('id', groupId);

    // Insert the new member row
    await supabase.from('group_members').insert({ group_id: groupId, user_id: inviteeId });

    // Reload to get updated member list
    const { user } = await import('./authStore').then(m => m.useAuthStore.getState());
    if (user) await get().loadGroups(user.id);
  },
}));
```

- [ ] **Step 2: Verify compilation**

Run: `cd aero-chat-app && npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add src/store/groupChatStore.ts
git commit -m "feat: add groupChatStore — group CRUD, invites, member management, key cache"
```

---

## Task 4: Group Message Store

**Files:**
- Create: `src/store/groupMessageStore.ts`

- [ ] **Step 1: Create `src/store/groupMessageStore.ts`**

```ts
import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { encryptGroupMessage, decryptGroupMessage } from '../lib/groupCrypto';
import { useGroupChatStore } from './groupChatStore';

// ── Types ──────────────────────────────────────────────────────────────────

export interface GroupMessage {
  id: string;
  group_id: string;
  sender_id: string;
  content: string; // decrypted plaintext
  created_at: string;
}

interface RawGroupMessage {
  id: string;
  group_id: string;
  sender_id: string;
  content: string; // ciphertext base64
  nonce: string;   // base64
  created_at: string;
}

// ── Store ──────────────────────────────────────────────────────────────────

interface GroupMessageStore {
  chats: Record<string, GroupMessage[]>; // groupId → messages

  loadMessages: (groupId: string) => Promise<void>;
  sendMessage: (groupId: string, plaintext: string, senderId: string) => Promise<void>;
  appendMessage: (groupId: string, raw: RawGroupMessage) => void;
  clearChat: (groupId: string) => void;
}

export const useGroupMessageStore = create<GroupMessageStore>()((set, get) => ({
  chats: {},

  loadMessages: async (groupId) => {
    const groupKey = useGroupChatStore.getState().groupKeys.get(groupId);
    if (!groupKey) return;

    const { data } = await supabase
      .from('group_messages')
      .select('*')
      .eq('group_id', groupId)
      .order('created_at', { ascending: true })
      .limit(200);
    if (!data) return;

    const decrypted: GroupMessage[] = [];
    for (const raw of data as RawGroupMessage[]) {
      const text = decryptGroupMessage(raw.content, raw.nonce, groupKey);
      if (text !== null) {
        decrypted.push({
          id: raw.id,
          group_id: raw.group_id,
          sender_id: raw.sender_id,
          content: text,
          created_at: raw.created_at,
        });
      }
    }

    set(s => ({ chats: { ...s.chats, [groupId]: decrypted } }));
  },

  sendMessage: async (groupId, plaintext, senderId) => {
    const groupKey = useGroupChatStore.getState().groupKeys.get(groupId);
    if (!groupKey) return;

    const { ciphertext, nonce } = encryptGroupMessage(plaintext, groupKey);

    const { data, error } = await supabase
      .from('group_messages')
      .insert({
        group_id: groupId,
        sender_id: senderId,
        content: ciphertext,
        nonce,
      })
      .select()
      .single();

    if (error || !data) return;

    // Optimistically add to local cache
    const msg: GroupMessage = {
      id: data.id,
      group_id: groupId,
      sender_id: senderId,
      content: plaintext,
      created_at: data.created_at,
    };
    set(s => ({
      chats: {
        ...s.chats,
        [groupId]: [...(s.chats[groupId] ?? []), msg],
      },
    }));
  },

  appendMessage: (groupId, raw) => {
    const groupKey = useGroupChatStore.getState().groupKeys.get(groupId);
    if (!groupKey) return;

    // Don't append duplicates
    const existing = get().chats[groupId] ?? [];
    if (existing.some(m => m.id === raw.id)) return;

    const text = decryptGroupMessage(raw.content, raw.nonce, groupKey);
    if (text === null) return;

    const msg: GroupMessage = {
      id: raw.id,
      group_id: raw.group_id,
      sender_id: raw.sender_id,
      content: text,
      created_at: raw.created_at,
    };

    set(s => ({
      chats: {
        ...s.chats,
        [groupId]: [...(s.chats[groupId] ?? []), msg],
      },
    }));
  },

  clearChat: (groupId) => {
    set(s => {
      const chats = { ...s.chats };
      delete chats[groupId];
      return { chats };
    });
  },
}));
```

- [ ] **Step 2: Verify compilation**

Run: `cd aero-chat-app && npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add src/store/groupMessageStore.ts
git commit -m "feat: add groupMessageStore — load, send, decrypt group messages"
```

---

## Task 5: Notification Helpers

**Files:**
- Modify: `src/lib/notifications.ts`

- [ ] **Step 1: Add group notification functions**

Append after the existing `showCallNotification` function at the end of the file:

```ts
/** Show a system notification for a group message */
export function showGroupMessageNotification(groupName: string, senderName: string, preview: string) {
  if (!('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;
  if (document.hasFocus()) return;

  new Notification(`${groupName} — ${senderName}`, {
    body: preview,
    icon: '/icons/icon.png',
    silent: false,
  });
}

/** Show a system notification for a group invite */
export function showGroupInviteNotification(groupName: string, inviterName: string) {
  if (!('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;
  if (document.hasFocus()) return;

  new Notification('Group Invite — AeroChat', {
    body: `${inviterName} invited you to ${groupName}`,
    icon: '/icons/icon.png',
    silent: false,
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/notifications.ts
git commit -m "feat: add group message and invite notification helpers"
```

---

## Task 6: Chat Store + ChatLayout Routing

**Files:**
- Modify: `src/store/chatStore.ts`
- Modify: `src/components/chat/ChatLayout.tsx`

- [ ] **Step 1: Extend chatStore with selectedGroupId**

In `src/store/chatStore.ts`, add `selectedGroupId` and ensure selecting a group clears the contact and vice versa:

```ts
import { create } from 'zustand';
import type { Profile } from './authStore';

interface ChatStore {
  selectedContact: Profile | null;
  selectedGroupId: string | null;
  setSelectedContact: (c: Profile | null) => void;
  setSelectedGroupId: (id: string | null) => void;
}

export const useChatStore = create<ChatStore>()((set) => ({
  selectedContact: null,
  selectedGroupId: null,
  setSelectedContact: (selectedContact) => set({ selectedContact, selectedGroupId: null }),
  setSelectedGroupId: (selectedGroupId) => set({ selectedGroupId, selectedContact: null }),
}));
```

- [ ] **Step 2: Add GroupChatWindow routing in ChatLayout**

In `src/components/chat/ChatLayout.tsx`:

**Add import** near the top (after `ChatWindow` import at line 3):
```ts
import { GroupChatWindow } from './GroupChatWindow';
```

**Add `selectedGroupId` to the destructured state** at line 51:
```ts
const { selectedContact, setSelectedContact, selectedGroupId } = useChatStore();
```

**Modify the routing block** at lines 420-452. Replace:
```tsx
) : selectedContact ? (
  <ChatWindow contact={selectedContact} />
) : (
```
With:
```tsx
) : selectedGroupId ? (
  <GroupChatWindow groupId={selectedGroupId} />
) : selectedContact ? (
  <ChatWindow contact={selectedContact} />
) : (
```

- [ ] **Step 3: Commit**

```bash
git add src/store/chatStore.ts src/components/chat/ChatLayout.tsx
git commit -m "feat: add selectedGroupId to chatStore, route to GroupChatWindow in ChatLayout"
```

---

## Task 7: Sidebar Tabs + Group List

**Files:**
- Modify: `src/components/chat/Sidebar.tsx`

This is the largest UI change — replace the "Friends" label with pill tabs, and render a group list when the Groups tab is active.

- [ ] **Step 1: Add imports to Sidebar.tsx**

Add these imports at the top of the file, alongside existing imports:

```ts
import { useGroupChatStore, type GroupChat } from '../../store/groupChatStore';
import { Plus, Users } from 'lucide-react';
```

Add `Users` to the existing lucide import line if not already present. Add `Plus` as well.

- [ ] **Step 2: Add tab state and group store selectors inside the Sidebar component**

Inside the `Sidebar` function body, near the existing state declarations, add:

```ts
const [activeTab, setActiveTab] = useState<'friends' | 'groups'>('friends');
const groups = useGroupChatStore(s => s.groups);
const selectedGroupId = useGroupChatStore(s => s.selectedGroupId);
const selectGroup = useGroupChatStore(s => s.selectGroup);
const [showCreateGroup, setShowCreateGroup] = useState(false);
```

- [ ] **Step 3: Replace the section label with pill tabs**

Replace the section label block at lines 566-571:

```tsx
{/* ── Section label ── */}
<div className="px-4 pb-2 pt-1">
  <p style={{ fontFamily: 'Inter, system-ui, sans-serif', fontWeight: 700, fontSize: 10, letterSpacing: '0.10em', textTransform: 'uppercase', color: 'var(--text-label)' }}>
    {query ? 'Search Results' : 'Friends'}
  </p>
</div>
```

With the pill tabs:

```tsx
{/* ── Friends / Groups tab bar ── */}
{!query && (
  <div className="flex items-center gap-0 mx-3 mb-2 mt-1" style={{ borderBottom: '1px solid var(--panel-divider)' }}>
    <button
      onClick={() => setActiveTab('friends')}
      className="flex-1 text-center py-2 transition-colors"
      style={{
        fontFamily: 'Inter, system-ui, sans-serif',
        fontWeight: 700,
        fontSize: 11,
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        color: activeTab === 'friends' ? '#00d4ff' : 'var(--text-muted)',
        borderBottom: activeTab === 'friends' ? '2px solid #00d4ff' : '2px solid transparent',
        marginBottom: -1,
      }}
    >
      Friends
    </button>
    <button
      onClick={() => setActiveTab('groups')}
      className="flex-1 text-center py-2 transition-colors"
      style={{
        fontFamily: 'Inter, system-ui, sans-serif',
        fontWeight: 700,
        fontSize: 11,
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        color: activeTab === 'groups' ? '#00d4ff' : 'var(--text-muted)',
        borderBottom: activeTab === 'groups' ? '2px solid #00d4ff' : '2px solid transparent',
        marginBottom: -1,
      }}
    >
      Groups
    </button>
  </div>
)}
{query && (
  <div className="px-4 pb-2 pt-1">
    <p style={{ fontFamily: 'Inter, system-ui, sans-serif', fontWeight: 700, fontSize: 10, letterSpacing: '0.10em', textTransform: 'uppercase', color: 'var(--text-label)' }}>
      Search Results
    </p>
  </div>
)}
```

- [ ] **Step 4: Wrap friend list in tab conditional, add group list**

Replace the `{!query && (` block at lines 629-683 with:

```tsx
{!query && activeTab === 'friends' && (
  <>
    {friends.length === 0 && (
      <div className="flex flex-col items-center px-2 py-10 text-center gap-3">
        <UserPlus className="h-9 w-9" style={{ color: 'var(--text-muted)', opacity: 0.5 }} />
        <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
          No friends yet.<br />Search for someone to add them!
        </p>
      </div>
    )}

    {STATUS_ORDER.map(status => {
      const group = groupedFriends[status];
      if (group.length === 0) return null;
      const collapsed = collapsedGroups[status] ?? false;
      return (
        <div key={status}>
          <button
            onClick={() => toggleGroup(status)}
            className="flex w-full items-center gap-2 px-3 py-1.5 text-left transition-colors duration-100"
            style={{ cursor: 'pointer' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--hover-bg)')}
            onMouseLeave={e => (e.currentTarget.style.background = '')}
          >
            {collapsed
              ? <ChevronDown className="h-3 w-3" style={{ color: 'var(--text-muted)', opacity: 0.6 }} />
              : <ChevronUp className="h-3 w-3" style={{ color: 'var(--text-muted)', opacity: 0.6 }} />}
            <span
              className="inline-block rounded-full shrink-0"
              style={{ width: 7, height: 7, background: statusColor[status], boxShadow: `0 0 4px ${statusColor[status]}88` }}
            />
            <span style={{
              fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em',
              color: 'var(--text-muted)', fontFamily: 'Inter, system-ui, sans-serif',
            }}>
              {statusLabel[status]}
            </span>
            <span style={{ fontSize: 10, color: 'var(--text-muted)', opacity: 0.6 }}>
              — {group.length}
            </span>
          </button>
          {!collapsed && group.map(f => (
            <FriendItem
              key={f.id}
              friend={f}
              isSelected={selectedUser?.id === f.id}
              onSelect={handleFriendSelect}
              currentUserId={user!.id}
            />
          ))}
        </div>
      );
    })}
  </>
)}

{!query && activeTab === 'groups' && (
  <>
    {/* Create group button */}
    <button
      onClick={() => setShowCreateGroup(true)}
      className="flex items-center gap-2 w-full rounded-aero px-3 py-2 mb-2 text-xs font-semibold transition-colors"
      style={{ color: '#00d4ff', border: '1px dashed rgba(0,212,255,0.25)' }}
      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(0,212,255,0.06)'}
      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = ''}
    >
      <Plus className="h-3.5 w-3.5" />
      Create Group
    </button>

    {groups.length === 0 && (
      <div className="flex flex-col items-center px-2 py-10 text-center gap-3">
        <Users className="h-9 w-9" style={{ color: 'var(--text-muted)', opacity: 0.5 }} />
        <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
          No groups yet.<br />Create one to get started!
        </p>
      </div>
    )}

    {groups.map(g => (
      <GroupItem
        key={g.id}
        group={g}
        isSelected={selectedGroupId === g.id}
        onSelect={() => {
          useChatStore.getState().setSelectedGroupId(g.id);
        }}
        currentUserId={user!.id}
      />
    ))}
  </>
)}
```

Import `useChatStore` at the top of the file:
```ts
import { useChatStore } from '../../store/chatStore';
```

- [ ] **Step 5: Add the GroupItem component after FriendItem**

Add below the `FriendItem` component at the bottom of the file:

```tsx
// ── GroupItem ────────────────────────────────────────────────────────────────

interface GroupItemProps {
  group: GroupChat;
  isSelected: boolean;
  onSelect: () => void;
  currentUserId: string;
}

const GroupItem = memo(function GroupItem({
  group, isSelected, onSelect, currentUserId,
}: GroupItemProps) {
  const unread = useUnreadStore(s => s.counts[`group:${group.id}`] ?? 0);
  const isMuted = useMuteStore(s => s.mutedIds.has(`group:${group.id}`));
  const toggleMute = useMuteStore(s => s.toggleMute);
  const [isHovered, setIsHovered] = useState(false);
  const leaveGroup = useGroupChatStore(s => s.leaveGroup);

  const memberNames = group.members
    .filter(m => m.user_id !== currentUserId)
    .map(m => m.profile?.username ?? '?')
    .join(', ');

  const onlineCount = group.members.filter(m => {
    return usePresenceStore.getState().onlineIds.has(m.user_id);
  }).length;

  const cardGradientCss = CARD_GRADIENTS.find(g2 => g2.id === group.card_gradient)?.css ?? null;

  return (
    <button
      onClick={onSelect}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="w-full text-left transition-all"
      style={{
        borderRadius: 12,
        overflow: 'hidden',
        position: 'relative',
        padding: '10px 12px',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        marginBottom: 4,
        border: isSelected
          ? '1px solid rgba(0,212,255,0.25)'
          : isHovered
            ? '1px solid rgba(255,255,255,0.08)'
            : '1px solid rgba(255,255,255,0.04)',
        cursor: 'pointer',
        background: isSelected
          ? 'linear-gradient(135deg, rgba(26,111,212,0.16) 0%, rgba(0,190,255,0.12) 100%)'
          : isHovered
            ? 'var(--hover-bg)'
            : 'transparent',
      }}
    >
      {/* Card background bleed */}
      {group.card_image_url ? (
        <>
          <div style={{ position: 'absolute', inset: 0, background: `url(${group.card_image_url}) center/cover`, borderRadius: 12 }} />
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)', borderRadius: 12 }} />
        </>
      ) : cardGradientCss ? (
        <div style={{ position: 'absolute', inset: 0, background: cardGradientCss, opacity: 0.12, borderRadius: 12 }} />
      ) : null}

      {/* Stacked avatars */}
      <div style={{ position: 'relative', width: Math.min(group.members.length, 3) * 10 + 24, height: 28, flexShrink: 0, zIndex: 1 }}>
        {group.members.slice(0, 3).map((m, i) => (
          <div key={m.user_id} style={{
            position: 'absolute',
            left: i * 10,
            top: i % 2 === 0 ? 0 : 2,
            width: 24,
            height: 24,
            borderRadius: '50%',
            border: '2px solid rgba(10,22,40,0.8)',
            zIndex: 3 - i,
            overflow: 'hidden',
            background: 'var(--sidebar-bg)',
          }}>
            {m.profile?.avatar_url ? (
              <img src={m.profile.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <div style={{
                width: '100%', height: '100%',
                background: 'linear-gradient(135deg, #1a6fd4, #00d4ff)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 10, fontWeight: 700, color: '#fff',
              }}>
                {(m.profile?.username ?? '?')[0].toUpperCase()}
              </div>
            )}
          </div>
        ))}
        {group.members.length > 3 && (
          <div style={{
            position: 'absolute', left: 30, top: 0,
            width: 24, height: 24, borderRadius: '50%',
            background: 'rgba(255,255,255,0.1)',
            border: '2px solid rgba(10,22,40,0.8)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 8, fontWeight: 700, color: 'rgba(255,255,255,0.6)',
            zIndex: 0,
          }}>
            +{group.members.length - 3}
          </div>
        )}
      </div>

      {/* Group info */}
      <div style={{ flex: 1, minWidth: 0, position: 'relative', zIndex: 1 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.9)' }} className="truncate">
          {group.name}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
          <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)' }} className="truncate">
            {memberNames}
          </span>
          {onlineCount > 0 && (
            <>
              <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.15)' }}>·</span>
              <span style={{
                display: 'inline-block', width: 5, height: 5, borderRadius: '50%',
                background: '#3dd87a', boxShadow: '0 0 4px rgba(61,216,122,0.5)',
              }} />
              <span style={{ fontSize: 8, color: 'rgba(61,216,122,0.7)' }}>
                {onlineCount} online
              </span>
            </>
          )}
        </div>
      </div>

      {/* Right side: unread badge + hover actions */}
      <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', gap: 4 }}>
        {isHovered && (
          <>
            <div
              onClick={e => { e.stopPropagation(); toggleMute(`group:${group.id}`); }}
              className="rounded-lg p-1 transition-colors cursor-pointer"
              style={{ color: isMuted ? '#f59e0b' : 'var(--text-muted)' }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.08)'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = ''}
              title={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted ? <BellOff className="h-3 w-3" /> : <Bell className="h-3 w-3" />}
            </div>
            <div
              onClick={e => { e.stopPropagation(); leaveGroup(group.id, currentUserId); }}
              className="rounded-lg p-1 transition-colors cursor-pointer"
              style={{ color: '#f87171' }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(248,113,113,0.12)'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = ''}
              title="Leave Group"
            >
              <LogOut className="h-3 w-3" />
            </div>
          </>
        )}
        {!isHovered && isMuted && (
          <div style={{
            width: 20, height: 20, borderRadius: 6,
            background: 'rgba(245,158,11,0.10)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <BellOff className="h-3 w-3" style={{ color: '#f59e0b', opacity: 0.7 }} />
          </div>
        )}
        {unread > 0 && (
          <div style={{
            background: '#ff4060', color: 'white',
            fontSize: 9, fontWeight: 700, borderRadius: 10,
            padding: '1px 6px', minWidth: 18, textAlign: 'center',
          }}>
            {unread}
          </div>
        )}
      </div>
    </button>
  );
});
```

- [ ] **Step 6: Add CreateGroupModal render**

Inside the Sidebar component's return JSX, before the closing `</aside>`, add:

```tsx
{showCreateGroup && (
  <CreateGroupModal onClose={() => setShowCreateGroup(false)} />
)}
```

And import at the top:
```ts
import { CreateGroupModal } from './CreateGroupModal';
```

- [ ] **Step 7: Commit**

```bash
git add src/components/chat/Sidebar.tsx
git commit -m "feat: add Friends/Groups pill tabs and GroupItem component in sidebar"
```

---

## Task 8: Create Group Modal

**Files:**
- Create: `src/components/chat/CreateGroupModal.tsx`

- [ ] **Step 1: Create `src/components/chat/CreateGroupModal.tsx`**

```tsx
import { useState, useEffect } from 'react';
import { X, Check, Users } from 'lucide-react';
import { useFriendStore } from '../../store/friendStore';
import { useAuthStore } from '../../store/authStore';
import { useGroupChatStore } from '../../store/groupChatStore';
import { AvatarImage } from '../ui/AvatarImage';

interface Props {
  onClose: () => void;
}

export function CreateGroupModal({ onClose }: Props) {
  const [name, setName] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState(false);
  const friends = useFriendStore(s => s.friends);
  const user = useAuthStore(s => s.user);
  const createGroup = useGroupChatStore(s => s.createGroup);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const toggleFriend = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else if (next.size < 3) {
        // Max 3 friends (creator is the 4th member)
        next.add(id);
      }
      return next;
    });
  };

  const handleCreate = async () => {
    if (!user || !name.trim() || selectedIds.size === 0) return;
    setCreating(true);
    await createGroup(name.trim(), Array.from(selectedIds), user.id);
    setCreating(false);
    onClose();
  };

  const canCreate = name.trim().length > 0 && selectedIds.size > 0 && !creating;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative w-full max-w-sm p-5 shadow-2xl animate-fade-in"
        style={{
          borderRadius: 20,
          border: '1px solid var(--popup-border)',
          background: 'var(--popup-bg)',
          boxShadow: 'var(--popup-shadow)',
          backdropFilter: 'blur(28px)',
        }}
      >
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4" style={{ color: '#00d4ff' }} />
            <h2 className="font-bold" style={{ color: 'var(--popup-text)' }}>Create Group</h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 transition-colors"
            style={{ color: 'var(--popup-text-muted)' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--popup-hover)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = ''; }}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Group name */}
        <input
          className="aero-input w-full mb-3 py-2 px-3 text-sm"
          placeholder="Group name"
          value={name}
          onChange={e => setName(e.target.value)}
          maxLength={50}
          autoFocus
        />

        {/* Friend picker */}
        <p className="text-xs font-semibold mb-2" style={{ color: 'var(--popup-text-muted)' }}>
          Select friends ({selectedIds.size}/3)
        </p>
        <div className="max-h-48 overflow-y-auto scrollbar-aero flex flex-col gap-1 mb-4">
          {friends.map(f => {
            const selected = selectedIds.has(f.id);
            return (
              <button
                key={f.id}
                onClick={() => toggleFriend(f.id)}
                className="flex items-center gap-3 rounded-aero px-3 py-2 transition-colors text-left w-full"
                style={{
                  background: selected ? 'rgba(0,212,255,0.08)' : 'transparent',
                  border: selected ? '1px solid rgba(0,212,255,0.2)' : '1px solid transparent',
                }}
                onMouseEnter={e => { if (!selected) (e.currentTarget as HTMLElement).style.background = 'var(--popup-hover)'; }}
                onMouseLeave={e => { if (!selected) (e.currentTarget as HTMLElement).style.background = ''; }}
              >
                <AvatarImage username={f.username} avatarUrl={f.avatar_url} size="sm" />
                <span className="flex-1 truncate text-sm font-medium" style={{ color: 'var(--popup-text)' }}>
                  {f.username}
                </span>
                {selected && (
                  <div style={{
                    width: 20, height: 20, borderRadius: '50%',
                    background: 'rgba(0,212,255,0.2)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Check className="h-3 w-3" style={{ color: '#00d4ff' }} />
                  </div>
                )}
              </button>
            );
          })}
          {friends.length === 0 && (
            <p className="py-4 text-center text-xs" style={{ color: 'var(--popup-text-muted)' }}>
              Add some friends first!
            </p>
          )}
        </div>

        {/* Create button */}
        <button
          onClick={handleCreate}
          disabled={!canCreate}
          className="w-full rounded-aero py-2.5 text-sm font-bold transition-all"
          style={{
            background: canCreate
              ? 'linear-gradient(135deg, #1a6fd4, #00d4ff)'
              : 'rgba(255,255,255,0.06)',
            color: canCreate ? '#fff' : 'var(--text-muted)',
            opacity: canCreate ? 1 : 0.5,
            cursor: canCreate ? 'pointer' : 'not-allowed',
          }}
        >
          {creating ? 'Creating...' : 'Create Group'}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify compilation**

Run: `cd aero-chat-app && npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add src/components/chat/CreateGroupModal.tsx
git commit -m "feat: add CreateGroupModal — name input + friend multi-select"
```

---

## Task 9: Group Invite Flow

**Files:**
- Modify: `src/components/chat/FriendRequestModal.tsx`

Group invites will appear in the same modal as friend requests, with visual distinction.

- [ ] **Step 1: Add group invite imports and store selectors**

At the top of `FriendRequestModal.tsx`, add:

```ts
import { useGroupChatStore, type GroupInvite } from '../../store/groupChatStore';
import { Users } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
```

Inside the component, add:

```ts
const { pendingInvites, acceptInvite, declineInvite } = useGroupChatStore();
const user = useAuthStore(s => s.user);
```

- [ ] **Step 2: Add group invites section below friend requests**

After the closing `</ul>` (or the "No pending requests" paragraph) for friend requests, and before the modal's closing `</div>`, add:

```tsx
{/* ── Group Invites ── */}
{pendingInvites.length > 0 && (
  <>
    <div className="my-3" style={{ height: 1, background: 'var(--popup-divider)' }} />
    <h3 className="flex items-center gap-2 mb-2 text-sm font-bold" style={{ color: 'var(--popup-text)' }}>
      <Users className="h-3.5 w-3.5" style={{ color: '#00d4ff' }} />
      Group Invites
    </h3>
    <ul className="flex flex-col gap-2">
      {pendingInvites.map(inv => (
        <li
          key={inv.id}
          className="flex items-center gap-3 rounded-aero px-3 py-2.5"
          style={{ background: 'var(--popup-item-bg)', border: '1px solid var(--popup-divider)' }}
        >
          <div style={{
            width: 32, height: 32, borderRadius: 10,
            background: 'linear-gradient(135deg, rgba(0,212,255,0.2), rgba(0,100,200,0.2))',
            border: '1px solid rgba(0,212,255,0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <Users className="h-4 w-4" style={{ color: '#00d4ff' }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="truncate text-sm font-medium" style={{ color: 'var(--popup-text)' }}>
              {inv.group?.name ?? 'Group'}
            </p>
            <p className="text-[10px]" style={{ color: 'var(--popup-text-muted)' }}>
              from {inv.inviter?.username ?? '?'}
            </p>
          </div>
          <button
            onClick={() => user && acceptInvite(inv.id, user.id)}
            className="rounded-lg p-1.5 transition-colors"
            style={{ color: '#4fc97a' }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(79,201,122,0.12)'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = ''}
            title="Accept"
          >
            <Check className="h-4 w-4" />
          </button>
          <button
            onClick={() => declineInvite(inv.id)}
            className="rounded-lg p-1.5 transition-colors"
            style={{ color: '#f87171' }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(248,113,113,0.12)'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = ''}
            title="Decline"
          >
            <UserX className="h-4 w-4" />
          </button>
        </li>
      ))}
    </ul>
  </>
)}
```

- [ ] **Step 3: Update the "No pending" empty state**

Change the empty state condition from `pendingIncoming.length === 0` to `pendingIncoming.length === 0 && pendingInvites.length === 0`:

```tsx
{pendingIncoming.length === 0 && pendingInvites.length === 0 ? (
  <p className="py-6 text-center text-sm" style={{ color: 'var(--popup-text-muted)' }}>No pending requests</p>
) : (
```

- [ ] **Step 4: Update the bell badge count in ChatLayout/Sidebar**

In whichever file renders the bell icon badge that opens `FriendRequestModal`, update the count to include group invites:

In `ChatLayout.tsx`, where `pendingIncoming` is used for the badge, change:
```ts
const { pendingIncoming } = useFriendStore();
```
To also read group invites:
```ts
const { pendingIncoming } = useFriendStore();
const pendingGroupInvites = useGroupChatStore(s => s.pendingInvites);
```

And update the badge count from `pendingIncoming.length` to `pendingIncoming.length + pendingGroupInvites.length`.

Add the import:
```ts
import { useGroupChatStore } from '../../store/groupChatStore';
```

- [ ] **Step 5: Commit**

```bash
git add src/components/chat/FriendRequestModal.tsx src/components/chat/ChatLayout.tsx
git commit -m "feat: show group invites in FriendRequestModal with accept/decline"
```

---

## Task 10: Group Chat Window

**Files:**
- Create: `src/components/chat/GroupChatWindow.tsx`

This component mirrors `ChatWindow` but for group context — header with group name + member avatars, message list with sender names, secretbox encryption, and a call button.

- [ ] **Step 1: Create `src/components/chat/GroupChatWindow.tsx`**

```tsx
import { useState, useEffect, useRef, useCallback, useMemo, memo } from 'react';
import { Send, Lock, Phone, Settings, Bell, BellOff, Users } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';
import { useGroupChatStore } from '../../store/groupChatStore';
import { useGroupMessageStore, type GroupMessage } from '../../store/groupMessageStore';
import { useUnreadStore } from '../../store/unreadStore';
import { usePresenceStore } from '../../store/presenceStore';
import { useMuteStore } from '../../store/muteStore';
import { useGroupCallStore } from '../../store/groupCallStore';
import { useFriendStore } from '../../store/friendStore';
import { AvatarImage, type Status } from '../ui/AvatarImage';
import { useVirtualizer } from '@tanstack/react-virtual';

function formatDateLabel(date: Date): string {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return 'Today';
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

interface Props {
  groupId: string;
}

export function GroupChatWindow({ groupId }: Props) {
  const user = useAuthStore(s => s.user);
  const group = useGroupChatStore(s => s.groups.find(g => g.id === groupId));
  const messages = useGroupMessageStore(s => s.chats[groupId] ?? []);
  const loadMessages = useGroupMessageStore(s => s.loadMessages);
  const sendMessage = useGroupMessageStore(s => s.sendMessage);
  const appendMessage = useGroupMessageStore(s => s.appendMessage);
  const clearUnread = useUnreadStore(s => s.clear);
  const isMuted = useMuteStore(s => s.mutedIds.has(`group:${groupId}`));
  const toggleMute = useMuteStore(s => s.toggleMute);
  const friends = useFriendStore(s => s.friends);
  const startGroupCall = useGroupCallStore(s => s.startGroupCall);

  const [text, setText] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const chatAreaRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  // Load messages on mount / group change
  useEffect(() => {
    loadMessages(groupId);
    clearUnread(`group:${groupId}`);
  }, [groupId]);

  // Subscribe to new group messages
  useEffect(() => {
    const channel = supabase
      .channel(`group-msg:${groupId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'group_messages',
        filter: `group_id=eq.${groupId}`,
      }, (payload) => {
        const raw = payload.new as any;
        // Skip own messages (already optimistically added)
        if (raw.sender_id === user?.id) return;
        appendMessage(groupId, raw);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [groupId, user?.id]);

  // Auto-scroll on new messages
  useEffect(() => {
    if (autoScroll && chatAreaRef.current) {
      chatAreaRef.current.scrollTop = chatAreaRef.current.scrollHeight;
    }
  }, [messages.length, autoScroll]);

  const handleScroll = useCallback(() => {
    if (!chatAreaRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = chatAreaRef.current;
    setAutoScroll(scrollHeight - scrollTop - clientHeight < 80);
  }, []);

  const handleSend = useCallback(async () => {
    if (!text.trim() || !user) return;
    const msg = text.trim();
    setText('');
    await sendMessage(groupId, msg, user.id);
  }, [text, user, groupId, sendMessage]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  const handleCall = useCallback(() => {
    if (!group) return;
    const memberProfiles = group.members
      .filter(m => m.user_id !== user?.id && m.profile)
      .map(m => m.profile!);
    startGroupCall(memberProfiles);
  }, [group, user?.id, startGroupCall]);

  // Build item list with date separators
  const itemList = useMemo(() =>
    messages.map((msg, i) => ({
      msg,
      showDate: i === 0 ||
        new Date(msg.created_at).toDateString() !== new Date(messages[i - 1].created_at).toDateString(),
    })),
  [messages]);

  const onlineCount = group?.members.filter(m =>
    usePresenceStore.getState().onlineIds.has(m.user_id)
  ).length ?? 0;

  if (!group || !user) return null;

  // Member lookup for sender names/avatars
  const memberMap = useMemo(() => {
    const map = new Map<string, { username: string; avatar_url: string | null }>();
    for (const m of group.members) {
      if (m.profile) map.set(m.user_id, { username: m.profile.username, avatar_url: m.profile.avatar_url });
    }
    return map;
  }, [group.members]);

  return (
    <div className="flex h-full flex-col">
      {/* ── Header ── */}
      <div
        className="flex items-center gap-3 px-5 py-3 flex-shrink-0"
        style={{
          borderBottom: '1px solid var(--panel-divider)',
          background: 'linear-gradient(180deg, rgba(0,100,255,0.08) 0%, transparent 100%), var(--panel-header-bg)',
          backdropFilter: 'blur(12px)',
          borderRadius: '18px 18px 0 0',
        }}
      >
        {/* Group icon */}
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: 'linear-gradient(135deg, rgba(0,212,255,0.2), rgba(0,100,200,0.2))',
          border: '1px solid rgba(0,212,255,0.15)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <Users className="h-4.5 w-4.5" style={{ color: '#00d4ff' }} />
        </div>

        {/* Group name + online */}
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm truncate" style={{ color: 'var(--text-primary)' }}>
            {group.name}
          </p>
          <div className="flex items-center gap-1.5 mt-0.5">
            {/* Small stacked avatars */}
            {group.members.slice(0, 4).map(m => (
              <div key={m.user_id} style={{
                width: 18, height: 18, borderRadius: '50%', overflow: 'hidden',
                border: '1.5px solid var(--panel-divider)',
              }}>
                {m.profile?.avatar_url ? (
                  <img src={m.profile.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <div style={{
                    width: '100%', height: '100%',
                    background: 'linear-gradient(135deg, #1a6fd4, #00d4ff)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 8, fontWeight: 700, color: '#fff',
                  }}>
                    {(m.profile?.username ?? '?')[0].toUpperCase()}
                  </div>
                )}
              </div>
            ))}
            <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 2 }}>
              {onlineCount} online
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1">
          {/* Mute */}
          <button
            onClick={() => toggleMute(`group:${groupId}`)}
            className="rounded-lg p-2 transition-colors"
            style={{
              color: isMuted ? '#f59e0b' : 'var(--text-muted)',
              background: isMuted ? 'rgba(245,158,11,0.10)' : 'transparent',
            }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = isMuted ? 'rgba(245,158,11,0.15)' : 'var(--hover-bg)'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = isMuted ? 'rgba(245,158,11,0.10)' : ''}
            title={isMuted ? 'Unmute group' : 'Mute group'}
          >
            {isMuted ? <BellOff className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
          </button>

          {/* Call */}
          <button
            onClick={handleCall}
            className="rounded-lg p-2 transition-colors"
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--hover-bg)'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = ''}
            title="Start group call"
          >
            <Phone className="h-4 w-4" />
          </button>

          {/* Settings (leader only) */}
          {group.leader_id === user.id && (
            <button
              onClick={() => setShowSettings(true)}
              className="rounded-lg p-2 transition-colors"
              style={{ color: 'var(--text-muted)' }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--hover-bg)'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = ''}
              title="Group settings"
            >
              <Settings className="h-4 w-4" />
            </button>
          )}

          {/* E2E indicator */}
          <Lock className="h-3.5 w-3.5 ml-1" style={{ color: 'var(--text-muted)', opacity: 0.5 }} />
        </div>
      </div>

      {/* ── Messages ── */}
      <div
        ref={chatAreaRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto scrollbar-aero px-4 py-3"
        style={{ position: 'relative' }}
      >
        {itemList.map(({ msg, showDate }, idx) => {
          const isMine = msg.sender_id === user.id;
          const sender = memberMap.get(msg.sender_id);

          return (
            <div key={msg.id}>
              {showDate && (
                <div className="my-4 flex items-center gap-3">
                  <div className="flex-1 h-px" style={{ background: 'var(--date-sep-line)' }} />
                  <span style={{ fontSize: 10, color: 'var(--date-sep-text)', fontWeight: 500, letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>
                    {formatDateLabel(new Date(msg.created_at))}
                  </span>
                  <div className="flex-1 h-px" style={{ background: 'var(--date-sep-line)' }} />
                </div>
              )}
              <div className={`flex mb-2 ${isMine ? 'justify-end' : 'justify-start'}`}>
                {!isMine && (
                  <div className="flex-shrink-0 mr-2 mt-1">
                    <AvatarImage
                      username={sender?.username ?? '?'}
                      avatarUrl={sender?.avatar_url}
                      size="sm"
                    />
                  </div>
                )}
                <div style={{ maxWidth: '70%' }}>
                  {!isMine && (
                    <p style={{ fontSize: 10, fontWeight: 600, color: '#00d4ff', marginBottom: 2 }}>
                      {sender?.username ?? '?'}
                    </p>
                  )}
                  <div
                    className={`rounded-aero-lg px-4 py-2.5 ${isMine ? 'sent-bubble-gloss' : ''}`}
                    style={{
                      background: isMine
                        ? 'linear-gradient(135deg, var(--bubble-sent-from), var(--bubble-sent-to))'
                        : 'var(--bubble-recv-bg)',
                      color: isMine ? 'var(--bubble-sent-text)' : 'var(--bubble-recv-text)',
                      border: isMine ? 'none' : '1px solid var(--bubble-recv-border)',
                      fontSize: 13,
                      lineHeight: 1.5,
                      wordBreak: 'break-word',
                    }}
                  >
                    {msg.content}
                  </div>
                  <p style={{
                    fontSize: 9,
                    color: 'var(--text-muted)',
                    opacity: 0.6,
                    marginTop: 2,
                    textAlign: isMine ? 'right' : 'left',
                  }}>
                    {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Input bar ── */}
      <div
        className="flex items-center gap-2 px-4 py-3 flex-shrink-0"
        style={{ borderTop: '1px solid var(--panel-divider)', background: 'var(--panel-header-bg)' }}
      >
        <input
          className="aero-input flex-1 py-2 px-3 text-sm"
          placeholder={`Message ${group.name}`}
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <button
          onClick={handleSend}
          disabled={!text.trim()}
          className="rounded-lg p-2 transition-colors"
          style={{
            color: text.trim() ? '#00d4ff' : 'var(--text-muted)',
            opacity: text.trim() ? 1 : 0.4,
          }}
        >
          <Send className="h-4 w-4" />
        </button>
      </div>

      {/* Group Settings Modal */}
      {showSettings && (
        <GroupSettingsModal groupId={groupId} onClose={() => setShowSettings(false)} />
      )}
    </div>
  );
}

// Lazy import to avoid circular deps — will be created in Task 11
const GroupSettingsModal = ({ groupId, onClose }: { groupId: string; onClose: () => void }) => {
  // Placeholder — replaced in Task 11
  return null;
};
```

- [ ] **Step 2: Verify compilation**

Run: `cd aero-chat-app && npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add src/components/chat/GroupChatWindow.tsx
git commit -m "feat: add GroupChatWindow — header, encrypted messages, input bar"
```

---

## Task 11: Group Settings Modal

**Files:**
- Create: `src/components/chat/GroupSettingsModal.tsx`
- Modify: `src/components/chat/GroupChatWindow.tsx` — replace placeholder import

- [ ] **Step 1: Create `src/components/chat/GroupSettingsModal.tsx`**

```tsx
import { useState, useEffect } from 'react';
import { X, UserMinus, Save } from 'lucide-react';
import { useGroupChatStore } from '../../store/groupChatStore';
import { useAuthStore } from '../../store/authStore';
import { AvatarImage } from '../ui/AvatarImage';
import { CARD_GRADIENTS } from '../../lib/cardGradients';
import { supabase } from '../../lib/supabase';

interface Props {
  groupId: string;
  onClose: () => void;
}

export function GroupSettingsModal({ groupId, onClose }: Props) {
  const user = useAuthStore(s => s.user);
  const group = useGroupChatStore(s => s.groups.find(g => g.id === groupId));
  const updateGroupCard = useGroupChatStore(s => s.updateGroupCard);
  const removeMember = useGroupChatStore(s => s.removeMember);

  const [name, setName] = useState(group?.name ?? '');
  const [selectedGradient, setSelectedGradient] = useState(group?.card_gradient ?? null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!group || !user) return null;

  const handleSave = async () => {
    setSaving(true);
    await updateGroupCard(groupId, {
      name: name.trim() || group.name,
      card_gradient: selectedGradient,
    });
    setSaving(false);
    onClose();
  };

  const handleRemoveMember = async (userId: string) => {
    await removeMember(groupId, userId);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const path = `${groupId}/${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from('group-images').upload(path, file);
    if (error) return;
    const { data } = supabase.storage.from('group-images').getPublicUrl(path);
    await updateGroupCard(groupId, { card_image_url: data.publicUrl });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative w-full max-w-sm p-5 shadow-2xl animate-fade-in max-h-[80vh] overflow-y-auto scrollbar-aero"
        style={{
          borderRadius: 20,
          border: '1px solid var(--popup-border)',
          background: 'var(--popup-bg)',
          boxShadow: 'var(--popup-shadow)',
          backdropFilter: 'blur(28px)',
        }}
      >
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-bold" style={{ color: 'var(--popup-text)' }}>Group Settings</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1 transition-colors"
            style={{ color: 'var(--popup-text-muted)' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--popup-hover)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = ''; }}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Group name */}
        <label className="text-xs font-semibold mb-1 block" style={{ color: 'var(--popup-text-muted)' }}>
          Group Name
        </label>
        <input
          className="aero-input w-full mb-4 py-2 px-3 text-sm"
          value={name}
          onChange={e => setName(e.target.value)}
          maxLength={50}
        />

        {/* Card gradient picker */}
        <label className="text-xs font-semibold mb-1 block" style={{ color: 'var(--popup-text-muted)' }}>
          Card Gradient
        </label>
        <div className="flex flex-wrap gap-2 mb-4">
          {CARD_GRADIENTS.slice(0, 12).map(g => (
            <button
              key={g.id}
              onClick={() => setSelectedGradient(g.id)}
              className="rounded-lg transition-all"
              style={{
                width: 32, height: 32,
                background: g.css,
                border: selectedGradient === g.id ? '2px solid #00d4ff' : '2px solid transparent',
                boxShadow: selectedGradient === g.id ? '0 0 8px rgba(0,212,255,0.3)' : 'none',
              }}
            />
          ))}
        </div>

        {/* Card image upload */}
        <label className="text-xs font-semibold mb-1 block" style={{ color: 'var(--popup-text-muted)' }}>
          Card Image
        </label>
        <label
          className="flex items-center justify-center w-full py-2 mb-4 rounded-aero text-xs font-medium cursor-pointer transition-colors"
          style={{ border: '1px dashed rgba(0,212,255,0.25)', color: '#00d4ff' }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(0,212,255,0.06)'}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = ''}
        >
          Upload Image
          <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
        </label>

        {/* Members list */}
        <label className="text-xs font-semibold mb-1 block" style={{ color: 'var(--popup-text-muted)' }}>
          Members ({group.members.length}/4)
        </label>
        <div className="flex flex-col gap-1 mb-4">
          {group.members.map(m => (
            <div
              key={m.user_id}
              className="flex items-center gap-3 rounded-aero px-3 py-2"
              style={{ background: 'var(--popup-item-bg)', border: '1px solid var(--popup-divider)' }}
            >
              <AvatarImage username={m.profile?.username ?? '?'} avatarUrl={m.profile?.avatar_url} size="sm" />
              <span className="flex-1 truncate text-sm font-medium" style={{ color: 'var(--popup-text)' }}>
                {m.profile?.username ?? '?'}
                {m.user_id === group.leader_id && (
                  <span className="ml-1.5 text-[9px] font-bold" style={{ color: '#f59e0b' }}>LEADER</span>
                )}
              </span>
              {m.user_id !== user.id && m.user_id !== group.leader_id && (
                <button
                  onClick={() => handleRemoveMember(m.user_id)}
                  className="rounded-lg p-1.5 transition-colors"
                  style={{ color: '#f87171' }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(248,113,113,0.12)'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = ''}
                  title="Remove member"
                >
                  <UserMinus className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Save button */}
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full rounded-aero py-2.5 text-sm font-bold transition-all flex items-center justify-center gap-2"
          style={{
            background: 'linear-gradient(135deg, #1a6fd4, #00d4ff)',
            color: '#fff',
            opacity: saving ? 0.6 : 1,
          }}
        >
          <Save className="h-3.5 w-3.5" />
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Update GroupChatWindow to import the real GroupSettingsModal**

In `src/components/chat/GroupChatWindow.tsx`, replace the placeholder `GroupSettingsModal` at the bottom of the file with a real import at the top:

```ts
import { GroupSettingsModal } from './GroupSettingsModal';
```

And remove the placeholder component definition at the bottom of the file.

- [ ] **Step 3: Verify compilation**

Run: `cd aero-chat-app && npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add src/components/chat/GroupSettingsModal.tsx src/components/chat/GroupChatWindow.tsx
git commit -m "feat: add GroupSettingsModal — name, gradient, image, member management"
```

---

## Task 12: App.tsx Realtime Channels

**Files:**
- Modify: `src/App.tsx`

Wire up three new realtime subscriptions: group invite notifications, group message unread counting, and leader-side invite acceptance handling.

- [ ] **Step 1: Add imports**

Add at the top of `src/App.tsx`:

```ts
import { useGroupChatStore } from './store/groupChatStore';
import { useGroupMessageStore } from './store/groupMessageStore';
import { showGroupMessageNotification, showGroupInviteNotification } from './lib/notifications';
```

- [ ] **Step 2: Load groups and invites on auth**

Find the existing `useEffect` that loads initial data (near lines 200-230 where unread counts are seeded). Add after it:

```ts
// Load groups + pending group invites on login
useEffect(() => {
  if (!user) return;
  useGroupChatStore.getState().loadGroups(user.id);
  useGroupChatStore.getState().loadInvites(user.id);
}, [user?.id]);
```

- [ ] **Step 3: Subscribe to group invites channel**

Add after the inbox channel `useEffect` (after line 262):

```ts
// Group invites — new invite notifications + leader-side accept handling
useEffect(() => {
  if (!user) return;

  // Channel for invites TO me (as invitee)
  const inviteeCh = supabase
    .channel(`group-invites:${user.id}`)
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'group_invites',
      filter: `invitee_id=eq.${user.id}`,
    }, () => {
      // Reload invites
      useGroupChatStore.getState().loadInvites(user.id);
    })
    .subscribe();

  // Channel for invites I SENT (as leader) — watch for accepts
  const leaderCh = supabase
    .channel(`group-invite-accepts:${user.id}`)
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'group_invites',
      filter: `inviter_id=eq.${user.id}`,
    }, async (payload) => {
      const invite = payload.new as { id: string; group_id: string; invitee_id: string; status: string };
      if (invite.status === 'accepted') {
        // Fetch the invitee's public key
        const { data: profile } = await supabase
          .from('profiles')
          .select('public_key')
          .eq('id', invite.invitee_id)
          .single();
        if (profile?.public_key) {
          await useGroupChatStore.getState().addMemberAfterAccept(
            invite.group_id,
            invite.invitee_id,
            profile.public_key,
          );
        }
      }
    })
    .subscribe();

  return () => {
    supabase.removeChannel(inviteeCh);
    supabase.removeChannel(leaderCh);
  };
}, [user?.id]);
```

- [ ] **Step 4: Subscribe to group messages for unread counting**

Add another `useEffect` after the invite channel:

```ts
// Group messages — unread counting + notifications for all groups
useEffect(() => {
  if (!user) return;
  const groups = useGroupChatStore.getState().groups;
  if (groups.length === 0) return;

  const channels = groups.map(g => {
    return supabase
      .channel(`group-unread:${g.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'group_messages',
        filter: `group_id=eq.${g.id}`,
      }, (payload) => {
        const msg = payload.new as { sender_id: string; group_id: string };
        if (msg.sender_id === user.id) return; // own message

        const activeGroupId = useChatStore.getState().selectedGroupId;
        const inGame = useCornerStore.getState().gameViewActive;
        const appIdle = document.hidden || !document.hasFocus();

        if (msg.group_id !== activeGroupId || inGame || appIdle) {
          increment(`group:${msg.group_id}`);
          // Notification + sound
          const grp = useGroupChatStore.getState().groups.find(gg => gg.id === msg.group_id);
          const sender = grp?.members.find(m => m.user_id === msg.sender_id);
          if (grp && sender?.profile) {
            showGroupMessageNotification(grp.name, sender.profile.username, '🔒 Encrypted message');
            if (!useMuteStore.getState().isMuted(`group:${msg.group_id}`)) {
              playMessageSound();
            }
          }
        }
      })
      .subscribe();
  });

  return () => { channels.forEach(ch => supabase.removeChannel(ch)); };
}, [user?.id, useGroupChatStore.getState().groups.length]);
```

Note: The dependency on `groups.length` ensures channels are re-created when the user joins/creates a new group. This is a pragmatic approach — we subscribe per-group rather than a single channel.

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx
git commit -m "feat: wire group invite + group message realtime channels in App.tsx"
```

---

## Task 13: Build, Push, Deploy

**Files:** None (build/deploy only)

- [ ] **Step 1: Full TypeScript check**

Run: `cd aero-chat-app && npx tsc --noEmit`

Fix any type errors that appear.

- [ ] **Step 2: Dev server smoke test**

Run: `cd aero-chat-app && pnpm dev`

Verify in browser:
1. Sidebar shows Friends/Groups pill tabs with cyan underline on active
2. Groups tab shows "Create Group" button and empty state
3. Clicking "+" opens CreateGroupModal with friend picker
4. Creating a group inserts rows and group appears in list
5. Invitee sees group invite in FriendRequestModal
6. Accepting invite adds member, group appears in their sidebar
7. Clicking a group opens GroupChatWindow with header, messages, input
8. Sending a message encrypts and appears for all members
9. Group call button rings all members
10. Leader can open settings and change group name/gradient
11. Unread badges appear on group cards
12. Tab title shows total unread count including groups

- [ ] **Step 3: Production build**

Run: `cd aero-chat-app && pnpm build`

Fix any build errors.

- [ ] **Step 4: Git push**

```bash
cd aero-chat-app && git push origin main
```

- [ ] **Step 5: Deploy to Vercel**

```bash
cd aero-chat-app && vercel --prod --yes
```
