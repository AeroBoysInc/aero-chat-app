# Servers & Bubbles: Community Spaces for AeroChat

## Overview

Add invite-only community spaces ("Servers") to AeroChat. Servers contain "Bubbles" — unified chat + voice rooms that replace the traditional channel model. Server owners create custom roles with granular permissions to control access. The entire servers experience lives in the Corner Rail with a full-screen takeover transition that makes it feel like entering a different world.

**Scope:** Server infrastructure, bubbles (chat + inline calls), custom roles/permissions, server management, UI (selection overlay, Bubble Hub, bubble chat).

**Out of scope:** Server toolkits (premium feature, deferred), server discovery/directory (invite-only), E2E encryption for server messages (uses RLS-protected plaintext; DMs remain E2E).

## Decisions

| Question | Decision |
|----------|----------|
| Discovery model? | Invite-only — no public directory, join via invite link or direct invite |
| Encryption? | Server messages: RLS-protected plaintext. DMs: unchanged E2E (NaCl box) |
| Where in UI? | Corner Rail icon → blur overlay → full takeover transition |
| Interior layout? | Bubble Hub (spatial floating bubbles around server icon) |
| Bubble entry? | Zoom-in transition — clicked bubble scales up to fill the view |
| Calls? | Inline banner at top of bubble chat, chat flows below, join when ready |
| Roles? | Custom roles with granular permissions + hierarchy |
| Creation? | Guided wizard: name → icon/banner → member cap. Auto-creates Owner role + "general" bubble |
| Member limits? | Owner-configurable cap (default 50, max 200) |
| Toolkits? | Deferred to premium features cycle |

## UI Flow

### Entry: Corner Rail → Server Selection Overlay

1. User clicks the **Servers icon** in the Corner Rail (left side, alongside Games/Writers/Calendar/Dev)
2. The entire app **blurs** behind a dark overlay
3. A **server card grid** appears — 5 cards per row, scrollable if many servers
4. Each card shows: banner image (or gradient fallback), server icon overlapping the banner edge, server name, description, stacked member avatars, member count, online count, unread message badge
5. Header contains: "Your Servers" title, "+ Create" button, "Join via Link" button, close (×) button
6. Clicking × or pressing Escape dismisses the overlay (unblur)

### Transition: Server Card → Bubble Hub

1. User clicks a server card
2. **Full takeover transition** (~400ms):
   - The DM world (sidebar + chat window) scales to 0.95, blurs, fades to opacity 0
   - The server world fades in from opacity 0, scales from 1.05 to 1.0
   - Crossfade overlap ~200ms
3. The entire viewport is now the server view — no sidebar, no DM chat visible

### Inside a Server: Bubble Hub

The Bubble Hub is a spatial layout where bubbles float around the server icon like a solar system.

**Header bar:**
- "← Back to DMs" link (triggers reverse takeover transition)
- Server icon + server name (centered)
- Member count + settings gear icon

**Bubble area:**
- Server icon centered (larger, with glow/shadow matching the server's gradient)
- Bubbles float around it as circles of varying sizes
- Each bubble shows: name, activity count ("5 chatting"), call indicator ("🔊 2 in call")
- Bubble size can vary based on activity (more active = slightly larger)
- "+" button to create a new bubble (if user has `manage_bubbles` permission)
- Background has ambient orbs matching the Aero aesthetic

**Bubble interactions:**
- Hover: subtle scale-up + glow
- Click: zoom-in transition

### Entering a Bubble: Zoom Transition

1. User clicks a bubble in the Hub
2. The clicked bubble **scales up** and expands to fill the screen
3. Other bubbles drift away / fade out
4. The bubble morphs into the chat view
5. Exiting (clicking "← Hub") reverses the animation — chat shrinks back to the bubble in the hub

### Inside a Bubble: Chat View

**Header:**
- "← Hub" back button
- Bubble color dot + bubble name
- "X in bubble" count
- Pin icon

**Call banner (when a call is active):**
- Persistent banner below the header
- Green pulsing dot + "Call active" label
- Stacked avatars of participants + count
- "Join" button on the right
- Non-intrusive — chat flows normally below it

**Messages:**
- Same rendering patterns as DM ChatWindow: avatars, timestamps, message content
- **Role badges** displayed next to usernames (colored pill with role name)
- Messages are NOT encrypted — stored as plaintext, protected by RLS
- Virtualized list (reuse @tanstack/react-virtual pattern)

**Input:**
- Same input area as DM chat — text input, file attachments
- Placeholder: "Message #bubble-name..."

**Joining a call:**
- Clicking "Join" on the banner expands the call UI (reuses existing `groupCallStore` + `GroupCallView` patterns — same WebRTC mesh, same VAD, same screen share)
- The call is scoped to the bubble — only members currently in the bubble can join
- Call participants grid appears above the chat
- Chat remains scrollable below
- "Leave call" button to exit the call without leaving the bubble

## Database Schema

### Tables

**`servers`**
| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | `gen_random_uuid()` |
| `owner_id` | UUID FK → profiles | Server creator |
| `name` | TEXT NOT NULL | Max 50 chars |
| `description` | TEXT | Max 200 chars, nullable |
| `icon_url` | TEXT | Nullable, falls back to gradient |
| `banner_url` | TEXT | Nullable, falls back to gradient |
| `member_cap` | INTEGER DEFAULT 50 | Owner-configurable, max 200 |
| `created_at` | TIMESTAMPTZ | `now()` |
| `updated_at` | TIMESTAMPTZ | `now()` |

**`server_roles`**
| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | `gen_random_uuid()` |
| `server_id` | UUID FK → servers ON DELETE CASCADE | |
| `name` | TEXT NOT NULL | e.g. "Moderator", "Player" |
| `color` | TEXT NOT NULL | Hex color for badge display |
| `position` | INTEGER NOT NULL | Higher = more authority. Owner role = 999 |
| `is_owner_role` | BOOLEAN DEFAULT false | True for auto-created Owner role, cannot be deleted |
| `created_at` | TIMESTAMPTZ | `now()` |

**`server_role_permissions`**
| Column | Type | Notes |
|--------|------|-------|
| `role_id` | UUID PK FK → server_roles ON DELETE CASCADE | |
| `manage_server` | BOOLEAN DEFAULT false | Edit server metadata, delete server |
| `manage_roles` | BOOLEAN DEFAULT false | Create/edit/delete roles below yours |
| `manage_bubbles` | BOOLEAN DEFAULT false | Create/edit/delete bubbles |
| `manage_members` | BOOLEAN DEFAULT false | Kick members, change roles below yours |
| `send_invites` | BOOLEAN DEFAULT false | Generate invite links |
| `send_messages` | BOOLEAN DEFAULT true | Chat in accessible bubbles |
| `pin_messages` | BOOLEAN DEFAULT false | Pin messages in bubbles |
| `start_calls` | BOOLEAN DEFAULT false | Start group calls in bubbles |

**`server_members`**
| Column | Type | Notes |
|--------|------|-------|
| `server_id` | UUID FK → servers ON DELETE CASCADE | |
| `user_id` | UUID FK → profiles ON DELETE CASCADE | |
| `role_id` | UUID FK → server_roles | Member's assigned role |
| `joined_at` | TIMESTAMPTZ | `now()` |
| PK | `(server_id, user_id)` | One role per member per server |

**`bubbles`**
| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | `gen_random_uuid()` |
| `server_id` | UUID FK → servers ON DELETE CASCADE | |
| `name` | TEXT NOT NULL | Max 30 chars |
| `color` | TEXT NOT NULL | Hex color for the bubble circle |
| `restricted_to_roles` | UUID[] | Array of role IDs. Empty = all members can access |
| `created_at` | TIMESTAMPTZ | `now()` |

**`bubble_messages`**
| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | `gen_random_uuid()` |
| `bubble_id` | UUID FK → bubbles ON DELETE CASCADE | |
| `sender_id` | UUID FK → profiles | |
| `content` | TEXT NOT NULL | Plaintext (not encrypted) |
| `created_at` | TIMESTAMPTZ | `now()` |

Index: `(bubble_id, created_at)` for message pagination.

**`server_invites`**
| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | `gen_random_uuid()` |
| `server_id` | UUID FK → servers ON DELETE CASCADE | |
| `created_by` | UUID FK → profiles | |
| `code` | TEXT UNIQUE NOT NULL | Short random code for the invite link |
| `expires_at` | TIMESTAMPTZ | Nullable (null = never expires) |
| `max_uses` | INTEGER | Nullable (null = unlimited) |
| `use_count` | INTEGER DEFAULT 0 | Incremented on each join |
| `created_at` | TIMESTAMPTZ | `now()` |

### RLS Policies (key rules)

**servers:** Members can read servers they belong to. Owner can update/delete.

**server_members:** Members can read the member list for their servers. `manage_members` permission holders can insert (invite) and delete (kick) members with lower role positions. Users can delete their own membership (leave).

**server_roles / server_role_permissions:** Members can read roles for their servers. `manage_roles` permission holders can insert/update/delete roles with lower positions than their own.

**bubbles:** Members can read bubbles in their servers (filtered by `restricted_to_roles` — if the array is empty, all members see it; if populated, only members whose role ID is in the array see it). `manage_bubbles` permission holders can insert/update/delete.

**bubble_messages:** Members can read messages in bubbles they have access to. `send_messages` permission holders can insert into accessible bubbles.

**server_invites:** `send_invites` permission holders can create invites. Any authenticated user can read an invite by code (to join). Creator can delete (revoke).

### Realtime Configuration

Enable `REPLICA IDENTITY FULL` on: `bubble_messages`, `server_members`, `bubbles`, `server_roles`.

### Storage Buckets

| Bucket | Access | Max size | Purpose |
|--------|--------|----------|---------|
| `server-icons` | Public | 2 MB | Server icon images |
| `server-banners` | Public | 5 MB | Server banner images |

## Realtime Channels

| Channel | Type | Subscribed when | Purpose |
|---------|------|-----------------|---------|
| `server_invites:{userId}` | Broadcast | Always (App.tsx) | Incoming server invites, powers unread badge on Corner Rail |
| `server:{serverId}` | Presence | Enter server (takeover) | Who's online in this server |
| `server_members:{serverId}` | Postgres Changes | Enter server | Member join/leave/role changes |
| `bubble:{bubbleId}` | Postgres Changes + Presence | Enter bubble (zoom in) | Messages (INSERT), typing (presence), "in bubble" count |

**Unsubscribe:** `server:{serverId}` and `server_members:{serverId}` on exit (back to DMs). `bubble:{bubbleId}` on exit (back to hub).

## Server Creation Wizard

Three-step modal, triggered by "+ Create" in the server selection overlay:

**Step 1 — Name & Description**
- Server name input (required, max 50 chars)
- Description textarea (optional, max 200 chars)
- "Next" button

**Step 2 — Icon & Banner**
- Upload server icon (cropped square, stored in `server-icons` bucket)
- Upload banner image (wide aspect, stored in `server-banners` bucket)
- Both optional — gradient generated from first character as fallback
- "Next" / "Skip" buttons

**Step 3 — Initial Setup**
- Member cap input (default 50, max 200)
- Preview of what will be created
- "Create Server" button

**On creation (single transaction):**
1. Insert server row
2. Insert Owner role (all permissions true, position 999, `is_owner_role = true`) + its permissions row
3. Insert default Member role (`send_messages` + `start_calls` true, position 1) + its permissions row
4. Insert server_members row (creator → Owner role)
5. Insert "general" bubble (default color, no role restrictions)

User is immediately taken into the new server via the full takeover transition.

## Server Settings

Accessible via the gear icon in the Bubble Hub header. Opens as a panel within the server view. Sections:

**Overview** — Edit name, description, icon, banner, member cap. Requires `manage_server` permission.

**Roles** — List of all roles ordered by position. Create/edit/delete roles. Each role: name, color, position (drag to reorder), 8 permission toggles. Can only manage roles with lower position than yours. Owner role is non-deletable/non-editable (except by transferring ownership). Requires `manage_roles` permission.

**Members** — List of all members with role badges. Change member role (must outrank them, requires `manage_members`). Kick member (same). Transfer ownership (Owner only — irreversible, swaps roles).

**Bubbles** — Create/edit/delete bubbles. Each bubble: name, color, optional role restrictions (multi-select from available roles). Requires `manage_bubbles` permission.

**Invites** — Generate invite links with optional expiry (1h, 24h, 7d, never) and max uses (1, 10, 50, unlimited). List active invites with use count. Revoke button. Requires `send_invites` permission.

## Joining a Server via Invite Link

1. User receives a link containing an invite code (e.g. `aero.chat/invite/abc123` or just a code they paste)
2. "Join via Link" button in server selection overlay opens a modal with a text input for the code
3. App fetches the invite by code — validates: not expired, not at max uses, server not at member cap
4. Shows server preview: name, icon, banner, member count, description
5. "Join Server" button — inserts a server_members row with a default "Member" role (auto-created alongside Owner on server creation, lowest position, basic permissions: `send_messages` + `start_calls`)
6. Invite `use_count` incremented
7. User enters the server via takeover transition

## File Map

### New files

| File | Responsibility |
|------|----------------|
| `supabase/migrations/016_servers.sql` | All tables, RLS, indexes, realtime config |
| `src/store/serverStore.ts` | Server list, selected server/bubble, CRUD, members |
| `src/store/serverMessageStore.ts` | Per-bubble message cache (localStorage, max 200/bubble) |
| `src/store/serverRoleStore.ts` | Roles + permissions for selected server |
| `src/components/servers/ServerOverlay.tsx` | Blur overlay with server card grid |
| `src/components/servers/ServerView.tsx` | Full takeover shell — header, routing between hub/bubble/settings |
| `src/components/servers/BubbleHub.tsx` | Spatial floating bubble layout |
| `src/components/servers/BubbleChat.tsx` | Message list + input (reuses ChatWindow patterns) |
| `src/components/servers/BubbleCallBanner.tsx` | Inline call banner with join button |
| `src/components/servers/ServerSettings.tsx` | Settings panel with tabs |
| `src/components/servers/RoleEditor.tsx` | Create/edit role with permission toggles |
| `src/components/servers/MemberList.tsx` | Member list with role management |
| `src/components/servers/BubbleManager.tsx` | Create/edit bubbles with role restrictions |
| `src/components/servers/InviteManager.tsx` | Generate/list/revoke invite links |
| `src/components/servers/CreateServerWizard.tsx` | 3-step creation modal |
| `src/components/servers/JoinServerModal.tsx` | Join via invite code flow |

### Modified files

| File | Changes |
|------|---------|
| `src/components/corners/CornerRail.tsx` | Add Servers icon with aggregate unread badge |
| `src/components/chat/ChatLayout.tsx` | Add server takeover state + transition animation (scale/blur/fade) |
| `src/App.tsx` | Subscribe to `server_invites:{userId}` channel for unread badge |
| `src/store/cornerStore.ts` | Add `serverView` state: `null` (DMs), `'overlay'`, `'server'`, `'bubble'` |

### Unchanged

All existing DM, call, chess, game, writer, calendar code. Servers are fully additive.
