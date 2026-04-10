# Group Chats — Design Spec

## Overview

Add group chat functionality to AeroChat. Users can create groups of up to 4 members, invite friends (who must accept), text with end-to-end encryption, customize the group card, and start group calls that ring all members. Groups live in a "Groups" tab alongside the existing "Friends" tab in the sidebar.

---

## Database Schema

### `group_chats` — one row per group

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid, PK | `gen_random_uuid()` |
| `name` | text, NOT NULL | Set by leader, required |
| `leader_id` | uuid, FK → profiles.id | Creator/owner |
| `group_key_encrypted` | jsonb | `{ [userId]: base64EncryptedSymmetricKey }` |
| `card_gradient` | text, nullable | Gradient preset ID (same IDs as profile cards) |
| `card_image_url` | text, nullable | URL in `group-images` bucket |
| `card_image_params` | jsonb, nullable | `{ zoom: number, x: number, y: number }` |
| `created_at` | timestamptz | `now()` |

**RLS:**
- SELECT: user must be in `group_members` for this group
- UPDATE: only `leader_id` can update `name`, `card_gradient`, `card_image_url`, `card_image_params`, `group_key_encrypted`
- DELETE: only `leader_id`
- INSERT: any authenticated user

### `group_members` — who's in each group

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid, PK | `gen_random_uuid()` |
| `group_id` | uuid, FK → group_chats.id ON DELETE CASCADE | |
| `user_id` | uuid, FK → profiles.id | |
| `joined_at` | timestamptz | `now()` |

**Constraints:** UNIQUE on `(group_id, user_id)`

**RLS:**
- SELECT: user must be a member of the group
- INSERT: only `leader_id` of the group can add members (triggered on invite accept)
- DELETE: user can remove themselves; leader can remove anyone

### `group_invites` — pending invitations

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid, PK | `gen_random_uuid()` |
| `group_id` | uuid, FK → group_chats.id ON DELETE CASCADE | |
| `inviter_id` | uuid, FK → profiles.id | |
| `invitee_id` | uuid, FK → profiles.id | |
| `status` | text | `'pending'` / `'accepted'` / `'declined'` |
| `created_at` | timestamptz | `now()` |

**Constraints:** UNIQUE on `(group_id, invitee_id)` — can't invite same person twice

**RLS:**
- SELECT: inviter or invitee
- INSERT: only group leader can create invites
- UPDATE: only invitee can change status (accept/decline)

### `group_messages` — encrypted group messages

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid, PK | `gen_random_uuid()` |
| `group_id` | uuid, FK → group_chats.id ON DELETE CASCADE | |
| `sender_id` | uuid, FK → profiles.id | |
| `content` | text | NaCl secretbox ciphertext (base64) |
| `nonce` | text | Base64-encoded 24-byte nonce |
| `created_at` | timestamptz | `now()` |

**Index:** `(group_id, created_at)`

**RLS:**
- SELECT: user must be in `group_members` for this group
- INSERT: user must be in `group_members` and `sender_id = auth.uid()`

### Storage: `group-images` bucket

- Public bucket for group card background images
- RLS: Only the group's `leader_id` can INSERT/UPDATE/DELETE
- Path convention: `{group_id}/{filename}`

---

## Encryption Model

### Group Key Lifecycle

**Group creation:**
1. Leader generates a random 32-byte NaCl secretbox key (the group symmetric key)
2. For each initial member (leader + accepted invitees), encrypt the symmetric key using `nacl.box(groupKey, nonce, memberPublicKey, leaderPrivateKey)`
3. Store in `group_chats.group_key_encrypted` as `{ [userId]: { encrypted: base64, nonce: base64 } }`
4. Each member decrypts with `nacl.box.open(encrypted, nonce, leaderPublicKey, myPrivateKey)` and caches in memory

**New member joins (accepts invite):**
1. Leader's client detects the accept (via realtime subscription on `group_invites`)
2. Leader encrypts the group key for the new member's public key
3. Updates `group_key_encrypted` to include the new member's entry
4. Inserts a row into `group_members`

**Member leaves/removed:**
- Their entry is removed from `group_key_encrypted` and `group_members`
- No key rotation in v1 — removed member loses channel access and can't receive new ciphertext
- Key rotation can be added as a follow-up

### Message Encryption

**Sending:** `nacl.secretbox(plaintext, randomNonce, groupKey)` → store `content` (ciphertext) + `nonce`

**Receiving:** `nacl.secretbox.open(content, nonce, groupKey)` → plaintext

---

## Sidebar UI

### Tab Bar

Replace the current "FRIENDS" label with horizontal pill tabs:

- Two tabs: **Friends** | **Groups**
- Active tab: cyan text + 2px cyan bottom border
- Inactive tab: muted text, no border
- Smooth transition between tabs
- Positioned where the "FRIENDS" label currently sits (above the search bar and friend list)

### Groups Tab Content

When the Groups tab is active:

1. **"+" Create Group button** at top (or alongside tab area)
2. **Group list** — each group rendered as a card with:
   - Stacked overlapping member avatars (left side, up to 3 visible + overflow indicator)
   - Group name (bold, 12px)
   - Member names subtitle (9px, muted)
   - Online member count with green dot (e.g. "2 online")
   - Group card gradient bleeding into the row background (like friend cards)
   - Unread badge (red pill, same as friend items)
   - Mute toggle on hover (same as friend items)
3. **Active call banner** on group cards when a call is in progress: small indicator showing "Call active" with join option

### Group Card Interactions

- **Click** → opens the group chat window (replaces the 1:1 chat window area)
- **Hover** → shows mute + leave buttons (leave instead of remove-friend)

---

## Group Creation Flow

1. User clicks "+" on Groups tab
2. **Create Group Modal** opens:
   - Group name text input (required)
   - Friend multi-select with checkboxes (max 3 friends, since creator is the 4th member)
   - Shows only accepted friends from `friendStore`
   - "Create" button (disabled until name + at least 1 friend selected)
3. On "Create":
   - Insert `group_chats` row (leader = current user)
   - Insert `group_members` row for the creator
   - Insert `group_invites` rows (status: `'pending'`) for each selected friend
   - Generate group symmetric key, encrypt for creator's public key, store in `group_key_encrypted`
4. Invitees see the invite in their notification area

---

## Group Invite Flow

### Invitee Experience

- Group invites appear in the **existing notification/bell area** alongside friend requests
- Display: "Group invite: **The Boys** — from Alice" with Accept/Decline buttons
- Visual distinction from friend requests (group icon instead of user icon)

### Accept Flow

1. Invitee clicks Accept
2. `group_invites.status` updated to `'accepted'`
3. Leader's client (subscribed to realtime on `group_invites`):
   - Encrypts group key for the new member
   - Updates `group_key_encrypted`
   - Inserts `group_members` row
4. New member's client receives the group in their groups list
5. New member decrypts the group key and can read/send messages

### Decline Flow

1. Invitee clicks Decline
2. `group_invites.status` updated to `'declined'`
3. No further action — the group continues without them

---

## Group Chat Window

### Header

- Group name (bold, 14px) with settings gear icon (leader only)
- Stacked member avatars (small, 20px)
- Online member count with dot
- **Call button** — starts a group call that rings all other members
- **Mute button** — same as 1:1 mute toggle
- Lock icon (E2E encrypted indicator)

### Messages

- **Other members' messages**: show sender avatar (small) + sender name (accent-colored, 10px) above the message bubble, on the left side
- **Own messages**: right-aligned, no avatar, same as 1:1
- **Date separators**: same as 1:1
- **Typing indicator**: "[Username] is typing..." with specific person's name

### Call Banner

When a group call is active (started by any member):
- **Persistent banner** at top of chat, below header
- Shows: "Call in progress — 2 of 3 members" + **Join** button
- Visible to ALL members including those who declined the call
- Members who declined or didn't answer can join at any time via this banner

### Input Bar

- Same as 1:1: text input, emoji picker, file attachment
- Messages encrypted with `nacl.secretbox` using the group's shared key
- Typing indicators broadcast to group channel

---

## Group Call Flow

### Initiation

1. Any member clicks the call button in the group chat header
2. All other group members receive a ringing notification (reuses existing group call modal)
3. Initiator sees status of each member: ringing / joined / declined

### Call Lifecycle

- Call persists as long as **at least one invitee hasn't decided yet** OR **at least one member (besides initiator) is connected**
- When a member declines: they stop ringing, but the call continues for others
- When all invitees have either joined or declined: call is active with whoever joined
- If all decline and nobody joined: call ends for the initiator too
- If at least one person joined: call stays active until all connected members hang up

### Late Join

- Members who declined or missed the initial ring see "Call in progress" banner in the group chat
- They can click **Join** to enter the active call at any time
- Uses the existing `groupCallStore` infrastructure for WebRTC peer connections

### Call UI

- Reuses existing `GroupCallView` component
- Tier visuals apply as already implemented
- Max 4 participants (full group)

---

## Realtime Channels

### Per-Group Channel: `group:{groupId}`

Subscribe when a group is loaded. Events:

- **postgres_changes on `group_messages`** (INSERT, filter: `group_id=eq.{groupId}`) — new messages
- **postgres_changes on `group_members`** (INSERT/DELETE, filter: `group_id=eq.{groupId}`) — member joins/leaves

### Group Invites Channel: `group-invites:{userId}`

Subscribe on login (alongside inbox channel). Events:

- **postgres_changes on `group_invites`** (INSERT/UPDATE, filter: `invitee_id=eq.{userId}`) — new invites or status changes

### Group Call Signaling

Reuses existing broadcast channel pattern: `call:group:{callId}` with `group:join`, `group:leave`, `group:offer`, `group:answer`, `group:ice`, `group:mute` events.

---

## Zustand Stores

### `groupChatStore` (new)

```
State:
  groups: GroupChat[]              // all groups the user is a member of
  selectedGroupId: string | null   // currently open group
  pendingInvites: GroupInvite[]    // incoming invites
  groupKeys: Map<string, Uint8Array>  // decrypted symmetric keys (in-memory only)

Actions:
  loadGroups()                     // fetch groups + members from DB
  loadInvites()                    // fetch pending invites
  createGroup(name, friendIds)     // create group + invites + generate key
  acceptInvite(inviteId)           // accept invite, receive group key
  declineInvite(inviteId)          // decline invite
  leaveGroup(groupId)              // remove self from group
  removeMember(groupId, userId)    // leader removes a member
  selectGroup(groupId | null)      // set active group
  updateGroupCard(groupId, fields) // leader updates card settings
```

### `groupMessageStore` (new)

```
State:
  chats: Record<groupId, CachedGroupMessage[]>  // per-group message cache

Actions:
  loadMessages(groupId)            // fetch + decrypt recent messages
  sendMessage(groupId, plaintext)  // encrypt + insert
  appendMessage(groupId, msg)      // add decrypted message to cache (from realtime)
  clearChat(groupId)               // clear local cache
```

### Modifications to Existing Stores

- **`unreadStore`**: Already supports arbitrary string keys — group unread counts will use `group:{groupId}` as keys
- **`muteStore`**: Same — mute keys will be `group:{groupId}`
- **`typingStore`**: Add group typing support — `typing[group:{groupId}:{userId}]`

---

## Member Removal / Leaving

### Member Leaves Voluntarily

1. Member clicks "Leave" in group hover or group settings
2. Delete their `group_members` row
3. Remove their entry from `group_key_encrypted`
4. Clear local group cache (messages, key)
5. Group disappears from their sidebar

### Leader Removes a Member

1. Leader clicks remove on a member in group settings
2. Same as above but triggered by leader
3. Removed member's realtime subscription catches the DELETE and cleans up locally

### Leader Leaves

- If the leader leaves, leadership transfers to the longest-tenured member (earliest `joined_at`)
- If the leader is the last member, the group is deleted (`ON DELETE CASCADE` cleans up everything)

---

## File Structure (New Files)

| File | Responsibility |
|------|---------------|
| `src/store/groupChatStore.ts` | Group state, invites, CRUD, key management |
| `src/store/groupMessageStore.ts` | Group message cache, send/receive/decrypt |
| `src/lib/groupCrypto.ts` | Group key generation, encryption, distribution |
| `src/components/chat/GroupChatWindow.tsx` | Group chat UI (header, messages, input, call banner) |
| `src/components/chat/CreateGroupModal.tsx` | Group creation modal (name + friend picker) |
| `src/components/chat/GroupSettingsModal.tsx` | Group settings (leader: name, card, remove members) |
| `supabase/migrations/031_group_chats.sql` | All 4 tables + RLS + storage bucket |

### Modified Files

| File | Changes |
|------|---------|
| `src/components/chat/Sidebar.tsx` | Friends/Groups tab bar, group list rendering, group item component |
| `src/components/chat/ChatLayout.tsx` | Route to GroupChatWindow when a group is selected |
| `src/App.tsx` | Subscribe to group invite channel, group message unread counting |
| `src/lib/notifications.ts` | Add `showGroupInviteNotification`, `showGroupMessageNotification` |
| `src/store/groupCallStore.ts` | Wire group calls to be initiatable from group chat context |
