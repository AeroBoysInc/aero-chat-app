# Servers & Bubbles Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add invite-only community servers with spatial Bubble Hub, custom roles/permissions, full-screen takeover transitions, and inline call banners to AeroChat.

**Architecture:** Servers are additive — no changes to existing DM/call/game code. New Supabase tables with RLS enforce membership. Server messages are plaintext (not E2E). The UI enters via the Corner Rail: blur overlay → server card grid → full takeover transition → Bubble Hub → zoom into bubble chat. Three new Zustand stores manage server state, messages, and roles.

**Tech Stack:** React 19, TypeScript, Zustand, Supabase (PostgreSQL + Realtime + Storage), Tailwind CSS, @tanstack/react-virtual, lucide-react.

**Design spec:** `docs/superpowers/specs/2026-04-05-servers-design.md`

---

### Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/016_servers.sql`

This task creates all 7 tables, RLS policies, indexes, realtime configuration, and storage buckets. Run this SQL in the Supabase SQL editor (it's too complex for the Supabase CLI on free tier).

- [ ] **Step 1: Create the migration file**

```sql
-- 016_servers.sql
-- ── Servers & Bubbles ───────────────────────────────────────────────────────

-- ── servers ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.servers (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id    UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name        TEXT        NOT NULL CHECK (char_length(name) <= 50),
  description TEXT        CHECK (description IS NULL OR char_length(description) <= 200),
  icon_url    TEXT,
  banner_url  TEXT,
  member_cap  INTEGER     NOT NULL DEFAULT 50 CHECK (member_cap >= 1 AND member_cap <= 200),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.servers ENABLE ROW LEVEL SECURITY;

-- ── server_roles ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.server_roles (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id     UUID        NOT NULL REFERENCES public.servers(id) ON DELETE CASCADE,
  name          TEXT        NOT NULL CHECK (char_length(name) <= 30),
  color         TEXT        NOT NULL DEFAULT '#00d4ff',
  position      INTEGER     NOT NULL DEFAULT 0,
  is_owner_role BOOLEAN     NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.server_roles ENABLE ROW LEVEL SECURITY;

-- ── server_role_permissions ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.server_role_permissions (
  role_id         UUID    PRIMARY KEY REFERENCES public.server_roles(id) ON DELETE CASCADE,
  manage_server   BOOLEAN NOT NULL DEFAULT false,
  manage_roles    BOOLEAN NOT NULL DEFAULT false,
  manage_bubbles  BOOLEAN NOT NULL DEFAULT false,
  manage_members  BOOLEAN NOT NULL DEFAULT false,
  send_invites    BOOLEAN NOT NULL DEFAULT false,
  send_messages   BOOLEAN NOT NULL DEFAULT true,
  pin_messages    BOOLEAN NOT NULL DEFAULT false,
  start_calls     BOOLEAN NOT NULL DEFAULT false
);

ALTER TABLE public.server_role_permissions ENABLE ROW LEVEL SECURITY;

-- ── server_members ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.server_members (
  server_id  UUID        NOT NULL REFERENCES public.servers(id) ON DELETE CASCADE,
  user_id    UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role_id    UUID        NOT NULL REFERENCES public.server_roles(id),
  joined_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (server_id, user_id)
);

ALTER TABLE public.server_members ENABLE ROW LEVEL SECURITY;

-- ── bubbles ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.bubbles (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id           UUID        NOT NULL REFERENCES public.servers(id) ON DELETE CASCADE,
  name                TEXT        NOT NULL CHECK (char_length(name) <= 30),
  color               TEXT        NOT NULL DEFAULT '#00d4ff',
  restricted_to_roles UUID[]      NOT NULL DEFAULT '{}',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.bubbles ENABLE ROW LEVEL SECURITY;

-- ── bubble_messages ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.bubble_messages (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  bubble_id  UUID        NOT NULL REFERENCES public.bubbles(id) ON DELETE CASCADE,
  sender_id  UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content    TEXT        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_bubble_messages_pagination ON public.bubble_messages (bubble_id, created_at);

ALTER TABLE public.bubble_messages ENABLE ROW LEVEL SECURITY;

-- ── server_invites ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.server_invites (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id  UUID        NOT NULL REFERENCES public.servers(id) ON DELETE CASCADE,
  created_by UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  code       TEXT        UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ,
  max_uses   INTEGER,
  use_count  INTEGER     NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.server_invites ENABLE ROW LEVEL SECURITY;


-- ═══════════════════════════════════════════════════════════════════════════════
-- HELPER: Check if the current user is a member of a given server
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION is_server_member(_server_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.server_members
    WHERE server_id = _server_id AND user_id = auth.uid()
  );
$$;

-- HELPER: Get the current user's role position in a server
CREATE OR REPLACE FUNCTION my_role_position(_server_id UUID)
RETURNS INTEGER
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT COALESCE(
    (SELECT sr.position FROM public.server_members sm
     JOIN public.server_roles sr ON sr.id = sm.role_id
     WHERE sm.server_id = _server_id AND sm.user_id = auth.uid()),
    -1
  );
$$;

-- HELPER: Check if current user has a specific permission in a server
CREATE OR REPLACE FUNCTION has_server_permission(_server_id UUID, _perm TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql STABLE SECURITY DEFINER
AS $$
DECLARE
  _val BOOLEAN;
BEGIN
  EXECUTE format(
    'SELECT p.%I FROM public.server_members sm
     JOIN public.server_role_permissions p ON p.role_id = sm.role_id
     WHERE sm.server_id = $1 AND sm.user_id = auth.uid()',
    _perm
  ) INTO _val USING _server_id;
  RETURN COALESCE(_val, false);
END;
$$;

-- HELPER: Check if user can access a bubble (member + role restriction check)
CREATE OR REPLACE FUNCTION can_access_bubble(_bubble_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.bubbles b
    JOIN public.server_members sm ON sm.server_id = b.server_id AND sm.user_id = auth.uid()
    WHERE b.id = _bubble_id
      AND (b.restricted_to_roles = '{}' OR sm.role_id = ANY(b.restricted_to_roles))
  );
$$;


-- ═══════════════════════════════════════════════════════════════════════════════
-- RLS POLICIES
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── servers ──────────────────────────────────────────────────────────────────
CREATE POLICY "servers_member_select" ON public.servers FOR SELECT
  USING (is_server_member(id));

CREATE POLICY "servers_insert" ON public.servers FOR INSERT
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "servers_owner_update" ON public.servers FOR UPDATE
  USING (owner_id = auth.uid() OR has_server_permission(id, 'manage_server'));

CREATE POLICY "servers_owner_delete" ON public.servers FOR DELETE
  USING (owner_id = auth.uid());

-- ── server_roles ─────────────────────────────────────────────────────────────
CREATE POLICY "roles_member_select" ON public.server_roles FOR SELECT
  USING (is_server_member(server_id));

CREATE POLICY "roles_manage_insert" ON public.server_roles FOR INSERT
  WITH CHECK (
    has_server_permission(server_id, 'manage_roles')
    AND position < my_role_position(server_id)
  );

CREATE POLICY "roles_manage_update" ON public.server_roles FOR UPDATE
  USING (
    has_server_permission(server_id, 'manage_roles')
    AND position < my_role_position(server_id)
    AND is_owner_role = false
  );

CREATE POLICY "roles_manage_delete" ON public.server_roles FOR DELETE
  USING (
    has_server_permission(server_id, 'manage_roles')
    AND position < my_role_position(server_id)
    AND is_owner_role = false
  );

-- ── server_role_permissions ──────────────────────────────────────────────────
CREATE POLICY "perms_member_select" ON public.server_role_permissions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.server_roles sr
      WHERE sr.id = role_id AND is_server_member(sr.server_id)
    )
  );

CREATE POLICY "perms_manage_insert" ON public.server_role_permissions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.server_roles sr
      WHERE sr.id = role_id
        AND has_server_permission(sr.server_id, 'manage_roles')
        AND sr.position < my_role_position(sr.server_id)
    )
  );

CREATE POLICY "perms_manage_update" ON public.server_role_permissions FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.server_roles sr
      WHERE sr.id = role_id
        AND has_server_permission(sr.server_id, 'manage_roles')
        AND sr.position < my_role_position(sr.server_id)
        AND sr.is_owner_role = false
    )
  );

CREATE POLICY "perms_manage_delete" ON public.server_role_permissions FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.server_roles sr
      WHERE sr.id = role_id
        AND has_server_permission(sr.server_id, 'manage_roles')
        AND sr.position < my_role_position(sr.server_id)
        AND sr.is_owner_role = false
    )
  );

-- ── server_members ───────────────────────────────────────────────────────────
CREATE POLICY "members_select" ON public.server_members FOR SELECT
  USING (is_server_member(server_id));

-- Owner can always insert (for creation flow). manage_members can add people.
CREATE POLICY "members_insert" ON public.server_members FOR INSERT
  WITH CHECK (
    -- Self-join (via invite flow — user_id must be auth.uid())
    user_id = auth.uid()
    OR
    -- manage_members permission holder adding someone
    has_server_permission(server_id, 'manage_members')
  );

CREATE POLICY "members_update" ON public.server_members FOR UPDATE
  USING (
    has_server_permission(server_id, 'manage_members')
    AND EXISTS (
      SELECT 1 FROM public.server_members sm2
      JOIN public.server_roles sr ON sr.id = sm2.role_id
      WHERE sm2.server_id = server_members.server_id
        AND sm2.user_id = server_members.user_id
        AND sr.position < my_role_position(server_members.server_id)
    )
  );

-- Leave (self) or kick (manage_members + outrank)
CREATE POLICY "members_delete" ON public.server_members FOR DELETE
  USING (
    user_id = auth.uid()
    OR (
      has_server_permission(server_id, 'manage_members')
      AND EXISTS (
        SELECT 1 FROM public.server_members sm2
        JOIN public.server_roles sr ON sr.id = sm2.role_id
        WHERE sm2.server_id = server_members.server_id
          AND sm2.user_id = server_members.user_id
          AND sr.position < my_role_position(server_members.server_id)
      )
    )
  );

-- ── bubbles ──────────────────────────────────────────────────────────────────
CREATE POLICY "bubbles_member_select" ON public.bubbles FOR SELECT
  USING (
    is_server_member(server_id)
    AND (
      restricted_to_roles = '{}'
      OR EXISTS (
        SELECT 1 FROM public.server_members sm
        WHERE sm.server_id = bubbles.server_id
          AND sm.user_id = auth.uid()
          AND sm.role_id = ANY(bubbles.restricted_to_roles)
      )
    )
  );

CREATE POLICY "bubbles_manage_insert" ON public.bubbles FOR INSERT
  WITH CHECK (has_server_permission(server_id, 'manage_bubbles'));

CREATE POLICY "bubbles_manage_update" ON public.bubbles FOR UPDATE
  USING (has_server_permission(server_id, 'manage_bubbles'));

CREATE POLICY "bubbles_manage_delete" ON public.bubbles FOR DELETE
  USING (has_server_permission(server_id, 'manage_bubbles'));

-- ── bubble_messages ──────────────────────────────────────────────────────────
CREATE POLICY "bmsg_read" ON public.bubble_messages FOR SELECT
  USING (can_access_bubble(bubble_id));

CREATE POLICY "bmsg_send" ON public.bubble_messages FOR INSERT
  WITH CHECK (
    sender_id = auth.uid()
    AND can_access_bubble(bubble_id)
    AND EXISTS (
      SELECT 1 FROM public.bubbles b
      WHERE b.id = bubble_id
        AND has_server_permission(b.server_id, 'send_messages')
    )
  );

-- ── server_invites ───────────────────────────────────────────────────────────
-- Anyone authenticated can read by code (for the join flow)
CREATE POLICY "invites_read_by_code" ON public.server_invites FOR SELECT
  USING (true);

CREATE POLICY "invites_create" ON public.server_invites FOR INSERT
  WITH CHECK (
    created_by = auth.uid()
    AND has_server_permission(server_id, 'send_invites')
  );

CREATE POLICY "invites_revoke" ON public.server_invites FOR DELETE
  USING (created_by = auth.uid() OR has_server_permission(server_id, 'manage_server'));

-- Update for incrementing use_count during join
CREATE POLICY "invites_use" ON public.server_invites FOR UPDATE
  USING (true)
  WITH CHECK (true);


-- ═══════════════════════════════════════════════════════════════════════════════
-- REALTIME
-- ═══════════════════════════════════════════════════════════════════════════════
ALTER TABLE public.bubble_messages REPLICA IDENTITY FULL;
ALTER TABLE public.server_members  REPLICA IDENTITY FULL;
ALTER TABLE public.bubbles         REPLICA IDENTITY FULL;
ALTER TABLE public.server_roles    REPLICA IDENTITY FULL;

-- Add tables to the supabase_realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.bubble_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.server_members;
ALTER PUBLICATION supabase_realtime ADD TABLE public.bubbles;
ALTER PUBLICATION supabase_realtime ADD TABLE public.server_roles;
```

- [ ] **Step 2: Run the migration in Supabase SQL editor**

Open the Supabase dashboard → SQL Editor → paste the contents of `016_servers.sql` → Run.

Expected: All tables created, RLS enabled, policies applied, realtime configured.

- [ ] **Step 3: Create storage buckets in Supabase dashboard**

1. Go to Supabase Dashboard → Storage
2. Create bucket `server-icons` — public, max file size 2MB
3. Create bucket `server-banners` — public, max file size 5MB

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/016_servers.sql
git commit -m "feat(servers): add database migration — 7 tables, RLS, realtime"
```

---

### Task 2: Types & Zustand Stores

**Files:**
- Create: `src/lib/serverTypes.ts`
- Create: `src/store/serverStore.ts`
- Create: `src/store/serverMessageStore.ts`
- Create: `src/store/serverRoleStore.ts`
- Modify: `src/store/cornerStore.ts`

- [ ] **Step 1: Create shared types file**

```ts
// src/lib/serverTypes.ts

export interface Server {
  id: string;
  owner_id: string;
  name: string;
  description: string | null;
  icon_url: string | null;
  banner_url: string | null;
  member_cap: number;
  created_at: string;
  updated_at: string;
}

export interface ServerRole {
  id: string;
  server_id: string;
  name: string;
  color: string;
  position: number;
  is_owner_role: boolean;
  created_at: string;
}

export interface ServerRolePermissions {
  role_id: string;
  manage_server: boolean;
  manage_roles: boolean;
  manage_bubbles: boolean;
  manage_members: boolean;
  send_invites: boolean;
  send_messages: boolean;
  pin_messages: boolean;
  start_calls: boolean;
}

export interface ServerMember {
  server_id: string;
  user_id: string;
  role_id: string;
  joined_at: string;
  // Joined from profiles:
  username?: string;
  avatar_url?: string | null;
}

export interface Bubble {
  id: string;
  server_id: string;
  name: string;
  color: string;
  restricted_to_roles: string[];
  created_at: string;
}

export interface BubbleMessage {
  id: string;
  bubble_id: string;
  sender_id: string;
  content: string;
  created_at: string;
}

export interface ServerInvite {
  id: string;
  server_id: string;
  created_by: string;
  code: string;
  expires_at: string | null;
  max_uses: number | null;
  use_count: number;
  created_at: string;
}

export type PermissionKey = keyof Omit<ServerRolePermissions, 'role_id'>;
```

- [ ] **Step 2: Create serverStore**

```ts
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

export const useServerStore = create<ServerStoreState>()((set, get) => ({
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
```

- [ ] **Step 3: Create serverMessageStore**

```ts
// src/store/serverMessageStore.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { BubbleMessage } from '../lib/serverTypes';

const MAX_PER_BUBBLE = 200;

interface ServerMessageStoreState {
  bubbles: Record<string, BubbleMessage[]>;
  setBubble: (bubbleId: string, messages: BubbleMessage[]) => void;
  appendMessage: (bubbleId: string, message: BubbleMessage) => void;
  clearBubble: (bubbleId: string) => void;
}

export const useServerMessageStore = create<ServerMessageStoreState>()(
  persist(
    (set) => ({
      bubbles: {},

      setBubble: (bubbleId, messages) =>
        set(s => ({
          bubbles: {
            ...s.bubbles,
            [bubbleId]: messages.slice(-MAX_PER_BUBBLE),
          },
        })),

      appendMessage: (bubbleId, message) =>
        set(s => {
          const existing = s.bubbles[bubbleId] ?? [];
          if (existing.some(m => m.id === message.id)) return s;
          return {
            bubbles: {
              ...s.bubbles,
              [bubbleId]: [...existing, message].slice(-MAX_PER_BUBBLE),
            },
          };
        }),

      clearBubble: (bubbleId) =>
        set(s => {
          const { [bubbleId]: _, ...rest } = s.bubbles;
          return { bubbles: rest };
        }),
    }),
    { name: 'aero-server-message-cache' }
  )
);
```

- [ ] **Step 4: Create serverRoleStore**

```ts
// src/store/serverRoleStore.ts
import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import type { ServerRole, ServerRolePermissions, PermissionKey } from '../lib/serverTypes';

interface RoleWithPerms extends ServerRole {
  permissions: ServerRolePermissions;
}

interface ServerRoleStoreState {
  roles: RoleWithPerms[];
  loadRoles: (serverId: string) => Promise<void>;
  getMyPermissions: (serverId: string, userId: string, members: { user_id: string; role_id: string }[]) => ServerRolePermissions | null;
  hasPermission: (serverId: string, userId: string, members: { user_id: string; role_id: string }[], perm: PermissionKey) => boolean;
  reset: () => void;
}

const DEFAULT_PERMS: ServerRolePermissions = {
  role_id: '',
  manage_server: false, manage_roles: false, manage_bubbles: false,
  manage_members: false, send_invites: false, send_messages: false,
  pin_messages: false, start_calls: false,
};

export const useServerRoleStore = create<ServerRoleStoreState>()((set, get) => ({
  roles: [],

  loadRoles: async (serverId) => {
    const { data: rolesData } = await supabase
      .from('server_roles')
      .select('*, server_role_permissions(*)')
      .eq('server_id', serverId)
      .order('position', { ascending: false });

    if (rolesData) {
      const roles: RoleWithPerms[] = rolesData.map((r: any) => ({
        id: r.id,
        server_id: r.server_id,
        name: r.name,
        color: r.color,
        position: r.position,
        is_owner_role: r.is_owner_role,
        created_at: r.created_at,
        permissions: r.server_role_permissions ?? DEFAULT_PERMS,
      }));
      set({ roles });
    }
  },

  getMyPermissions: (_serverId, userId, members) => {
    const membership = members.find(m => m.user_id === userId);
    if (!membership) return null;
    const role = get().roles.find(r => r.id === membership.role_id);
    return role?.permissions ?? null;
  },

  hasPermission: (serverId, userId, members, perm) => {
    const perms = get().getMyPermissions(serverId, userId, members);
    return perms ? perms[perm] : false;
  },

  reset: () => set({ roles: [] }),
}));
```

- [ ] **Step 5: Update cornerStore with server view state**

In `src/store/cornerStore.ts`, add the `serverView` state. The server view has four states: `null` (DMs visible), `'overlay'` (blur overlay with server cards), `'server'` (inside a server's Bubble Hub), `'bubble'` (inside a bubble's chat).

Add these to the `CornerStore` interface:

```ts
serverView: null | 'overlay' | 'server' | 'bubble';
openServerOverlay: () => void;
closeServerOverlay: () => void;
enterServer: () => void;
enterBubble: () => void;
exitToHub: () => void;
exitToDMs: () => void;
```

Add to the initial state and actions:

```ts
serverView: null,
openServerOverlay: () => set({ serverView: 'overlay', gameViewActive: false, devViewActive: false, writerViewActive: false, calendarViewActive: false, selectedGame: null, gameChatOverlay: null }),
closeServerOverlay: () => set({ serverView: null }),
enterServer: () => set({ serverView: 'server' }),
enterBubble: () => set({ serverView: 'bubble' }),
exitToHub: () => set({ serverView: 'server' }),
exitToDMs: () => set({ serverView: null }),
```

Also update all existing `open*` actions to include `serverView: null` so opening any other corner closes servers:

```ts
openGameHub: () => set({ gameViewActive: true, writerViewActive: false, devViewActive: false, calendarViewActive: false, serverView: null }),
openDevView: () => set({ devViewActive: true, gameViewActive: false, writerViewActive: false, calendarViewActive: false, selectedGame: null, gameChatOverlay: null, serverView: null }),
openWriterHub: () => set({ writerViewActive: true, gameViewActive: false, devViewActive: false, calendarViewActive: false, selectedGame: null, gameChatOverlay: null, serverView: null }),
openCalendarView: () => set({ calendarViewActive: true, gameViewActive: false, devViewActive: false, writerViewActive: false, selectedGame: null, gameChatOverlay: null, serverView: null }),
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/serverTypes.ts src/store/serverStore.ts src/store/serverMessageStore.ts src/store/serverRoleStore.ts src/store/cornerStore.ts
git commit -m "feat(servers): add types, 3 Zustand stores, cornerStore server states"
```

---

### Task 3: Corner Rail — Servers Icon

**Files:**
- Modify: `src/components/corners/CornerRail.tsx`

- [ ] **Step 1: Add Servers icon with unread badge**

Add `Globe` import from lucide-react. Add `serverView` and `openServerOverlay`/`closeServerOverlay` from cornerStore. Add `serverUnreads` from serverStore.

After the calendar `RailBtn` (line ~121) and before the closing `</div>` of the main button group, add a separator and the servers button:

```tsx
{/* Separator */}
<div style={{ width: 20, height: 1, background: 'var(--panel-divider)', opacity: 0.5 }} />

{/* Servers — slightly larger, glowing treatment */}
<div className="relative">
  <RailBtn
    icon={Globe}
    isActive={serverView === 'overlay' || serverView === 'server' || serverView === 'bubble'}
    color="#00d4ff"
    tooltip={serverView ? 'Close Servers' : 'Servers'}
    onClick={() => serverView ? closeServerOverlay() : openServerOverlay()}
  />
  {totalUnread > 0 && !serverView && (
    <div
      className="absolute -top-1 -right-1 flex items-center justify-center rounded-full"
      style={{
        minWidth: 16, height: 16, padding: '0 4px',
        background: '#ff2e63', fontSize: 9, fontWeight: 700,
        color: 'white', border: '2px solid var(--sidebar-bg)',
      }}
    >
      {totalUnread > 99 ? '99+' : totalUnread}
    </div>
  )}
</div>
```

Compute `totalUnread` above the return:

```tsx
const serverUnreads = useServerStore(s => s.serverUnreads);
const totalUnread = Object.values(serverUnreads).reduce((a, b) => a + b, 0);
```

Add imports at the top:

```tsx
import { Gamepad2, Terminal, PenTool, CalendarDays, Globe } from 'lucide-react';
import { useServerStore } from '../../store/serverStore';
```

- [ ] **Step 2: Verify**

Run: `cd aero-chat-app && pnpm build`

Expected: Build succeeds. The Servers icon appears in the corner rail with a globe icon, separator above it, and optional unread badge.

- [ ] **Step 3: Commit**

```bash
git add src/components/corners/CornerRail.tsx
git commit -m "feat(servers): add Servers icon to Corner Rail with unread badge"
```

---

### Task 4: Server Selection Overlay

**Files:**
- Create: `src/components/servers/ServerOverlay.tsx`

- [ ] **Step 1: Create the server selection overlay component**

This is the blur overlay with server card grid, "+ Create" button, "Join via Link" button. It appears when `serverView === 'overlay'`.

```tsx
// src/components/servers/ServerOverlay.tsx
import { memo, useState, useEffect, useCallback } from 'react';
import { X, Plus, Link2 } from 'lucide-react';
import { useCornerStore } from '../../store/cornerStore';
import { useServerStore } from '../../store/serverStore';
import { usePresenceStore } from '../../store/presenceStore';
import type { Server } from '../../lib/serverTypes';

function ServerCard({ server, onlineCount, unread, onClick }: {
  server: Server;
  onlineCount: number;
  unread: number;
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const initial = server.name.charAt(0).toUpperCase();

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="cursor-pointer overflow-hidden"
      style={{
        borderRadius: 14,
        border: '1px solid var(--panel-divider)',
        background: 'var(--sidebar-bg)',
        transform: hovered ? 'translateY(-2px)' : 'none',
        boxShadow: hovered ? '0 8px 24px rgba(0,0,0,0.3)' : 'none',
        transition: 'transform 0.2s, box-shadow 0.2s',
        display: 'flex', flexDirection: 'column',
      }}
    >
      {/* Banner */}
      <div style={{ height: 80, position: 'relative', overflow: 'hidden' }}>
        {server.banner_url ? (
          <img src={server.banner_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <div style={{ width: '100%', height: '100%', background: `linear-gradient(135deg, var(--sent-bubble-bg), var(--input-focus-border))` }} />
        )}
        {unread > 0 && (
          <div
            className="absolute flex items-center justify-center rounded-full"
            style={{
              top: 6, right: 6, minWidth: 18, height: 18, padding: '0 5px',
              background: '#ff2e63', fontSize: 9, fontWeight: 700, color: 'white',
            }}
          >
            {unread > 99 ? '99+' : unread}
          </div>
        )}
      </div>

      {/* Info */}
      <div style={{ padding: '10px 12px', flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div className="flex items-center gap-2">
          <div style={{
            width: 28, height: 28, borderRadius: 8, flexShrink: 0, marginTop: -20,
            border: '2px solid var(--sidebar-bg)',
            background: server.icon_url ? `url(${server.icon_url}) center/cover` : `linear-gradient(135deg, var(--sent-bubble-bg), var(--input-focus-border))`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 12, fontWeight: 700, color: 'white',
          }}>
            {!server.icon_url && initial}
          </div>
          <span className="truncate text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>
            {server.name}
          </span>
        </div>
        {server.description && (
          <p className="mt-1 truncate" style={{ fontSize: 10, color: 'var(--text-muted)' }}>
            {server.description}
          </p>
        )}
        <div className="mt-auto pt-2" style={{ fontSize: 9, color: 'var(--text-muted)' }}>
          <span style={{ color: onlineCount > 0 ? '#4fc97a' : undefined }}>{onlineCount} online</span>
        </div>
      </div>
    </div>
  );
}

export const ServerOverlay = memo(function ServerOverlay({
  onCreateClick,
  onJoinClick,
}: {
  onCreateClick: () => void;
  onJoinClick: () => void;
}) {
  const { closeServerOverlay, enterServer } = useCornerStore();
  const { servers, serverUnreads, selectServer, clearUnread, loadServers } = useServerStore();

  useEffect(() => { loadServers(); }, []);

  const handleSelect = useCallback((server: Server) => {
    selectServer(server.id);
    clearUnread(server.id);
    enterServer();
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') closeServerOverlay();
  }, []);

  return (
    <div
      onKeyDown={handleKeyDown}
      tabIndex={-1}
      className="animate-fade-in"
      style={{
        position: 'fixed', inset: 0, zIndex: 50,
        backdropFilter: 'blur(20px)',
        background: 'rgba(0,0,0,0.55)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        paddingTop: 80, overflow: 'auto',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) closeServerOverlay(); }}
    >
      <div
        style={{
          width: '90%', maxWidth: 900, maxHeight: 'calc(100vh - 120px)',
          display: 'flex', flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>Your Servers</h2>
            <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
              {servers.length} server{servers.length !== 1 ? 's' : ''}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onCreateClick}
              className="flex items-center gap-1.5 rounded-aero px-3 py-1.5 transition-opacity hover:opacity-80"
              style={{
                fontSize: 11, fontWeight: 500, color: '#00d4ff',
                background: 'rgba(0,212,255,0.12)', border: '1px solid rgba(0,212,255,0.25)',
              }}
            >
              <Plus className="h-3 w-3" /> Create
            </button>
            <button
              onClick={onJoinClick}
              className="flex items-center gap-1.5 rounded-aero px-3 py-1.5 transition-opacity hover:opacity-80"
              style={{
                fontSize: 11, fontWeight: 500, color: 'var(--text-secondary)',
                background: 'rgba(255,255,255,0.06)', border: '1px solid var(--panel-divider)',
              }}
            >
              <Link2 className="h-3 w-3" /> Join via Link
            </button>
            <button
              onClick={closeServerOverlay}
              className="ml-1 rounded-full p-1.5 transition-opacity hover:opacity-70"
              style={{ color: 'var(--text-muted)' }}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Server card grid — 5 per row */}
        <div
          className="overflow-y-auto"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(5, 1fr)',
            gap: 12,
            paddingBottom: 24,
          }}
        >
          {servers.map(server => (
            <ServerCard
              key={server.id}
              server={server}
              onlineCount={0}
              unread={serverUnreads[server.id] ?? 0}
              onClick={() => handleSelect(server)}
            />
          ))}
          {servers.length === 0 && (
            <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: 40 }}>
              <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>No servers yet</p>
              <p style={{ color: 'var(--text-muted)', fontSize: 11, marginTop: 4 }}>
                Create one or join via an invite link
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});
```

- [ ] **Step 2: Commit**

```bash
git add src/components/servers/ServerOverlay.tsx
git commit -m "feat(servers): create ServerOverlay — blur backdrop with server card grid"
```

---

### Task 5: Server Creation Wizard

**Files:**
- Create: `src/components/servers/CreateServerWizard.tsx`

- [ ] **Step 1: Create the 3-step wizard component**

```tsx
// src/components/servers/CreateServerWizard.tsx
import { memo, useState, useRef } from 'react';
import { X, ArrowRight, Upload, Sparkles } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';
import { useServerStore } from '../../store/serverStore';
import { useCornerStore } from '../../store/cornerStore';

export const CreateServerWizard = memo(function CreateServerWizard({
  onClose,
}: {
  onClose: () => void;
}) {
  const user = useAuthStore(s => s.user);
  const { addServer, selectServer, loadServerData } = useServerStore();
  const { enterServer } = useCornerStore();

  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [iconFile, setIconFile] = useState<File | null>(null);
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [iconPreview, setIconPreview] = useState<string | null>(null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);
  const [memberCap, setMemberCap] = useState(50);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const iconRef = useRef<HTMLInputElement>(null);
  const bannerRef = useRef<HTMLInputElement>(null);

  const handleIconChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIconFile(file);
    setIconPreview(URL.createObjectURL(file));
  };

  const handleBannerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBannerFile(file);
    setBannerPreview(URL.createObjectURL(file));
  };

  const handleCreate = async () => {
    if (!user || !name.trim()) return;
    setCreating(true);
    setError('');

    try {
      // 1. Upload icon/banner if provided
      let icon_url: string | null = null;
      let banner_url: string | null = null;

      if (iconFile) {
        const path = `${user.id}/${Date.now()}-icon`;
        const { error: upErr } = await supabase.storage.from('server-icons').upload(path, iconFile);
        if (!upErr) {
          const { data: urlData } = supabase.storage.from('server-icons').getPublicUrl(path);
          icon_url = urlData.publicUrl;
        }
      }
      if (bannerFile) {
        const path = `${user.id}/${Date.now()}-banner`;
        const { error: upErr } = await supabase.storage.from('server-banners').upload(path, bannerFile);
        if (!upErr) {
          const { data: urlData } = supabase.storage.from('server-banners').getPublicUrl(path);
          banner_url = urlData.publicUrl;
        }
      }

      // 2. Insert server
      const { data: server, error: sErr } = await supabase
        .from('servers')
        .insert({ owner_id: user.id, name: name.trim(), description: description.trim() || null, icon_url, banner_url, member_cap: memberCap })
        .select()
        .single();
      if (sErr || !server) throw new Error(sErr?.message ?? 'Failed to create server');

      // 3. Insert Owner role + permissions
      const { data: ownerRole, error: orErr } = await supabase
        .from('server_roles')
        .insert({ server_id: server.id, name: 'Owner', color: '#ff6b35', position: 999, is_owner_role: true })
        .select()
        .single();
      if (orErr || !ownerRole) throw new Error(orErr?.message ?? 'Failed to create owner role');

      await supabase.from('server_role_permissions').insert({
        role_id: ownerRole.id,
        manage_server: true, manage_roles: true, manage_bubbles: true,
        manage_members: true, send_invites: true, send_messages: true,
        pin_messages: true, start_calls: true,
      });

      // 4. Insert default Member role + permissions
      const { data: memberRole, error: mrErr } = await supabase
        .from('server_roles')
        .insert({ server_id: server.id, name: 'Member', color: '#8b949e', position: 1, is_owner_role: false })
        .select()
        .single();
      if (mrErr || !memberRole) throw new Error(mrErr?.message ?? 'Failed to create member role');

      await supabase.from('server_role_permissions').insert({
        role_id: memberRole.id,
        manage_server: false, manage_roles: false, manage_bubbles: false,
        manage_members: false, send_invites: false, send_messages: true,
        pin_messages: false, start_calls: true,
      });

      // 5. Insert creator as member with Owner role
      await supabase.from('server_members').insert({
        server_id: server.id, user_id: user.id, role_id: ownerRole.id,
      });

      // 6. Insert "general" bubble
      await supabase.from('bubbles').insert({
        server_id: server.id, name: 'general', color: '#00d4ff', restricted_to_roles: [],
      });

      // 7. Navigate into the new server
      addServer(server);
      selectServer(server.id);
      await loadServerData(server.id);
      enterServer();
      onClose();
    } catch (err: any) {
      setError(err.message ?? 'Something went wrong');
    } finally {
      setCreating(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 12px', borderRadius: 10, fontSize: 13,
    background: 'var(--input-bg)', border: '1px solid var(--input-border)',
    color: 'var(--text-primary)', outline: 'none',
  };

  return (
    <div
      className="animate-fade-in"
      style={{ position: 'fixed', inset: 0, zIndex: 60, backdropFilter: 'blur(24px)', background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ width: 440, borderRadius: 18, background: 'var(--sidebar-bg)', border: '1px solid var(--panel-divider)', overflow: 'hidden' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--panel-divider)' }}>
          <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
            Create Server — Step {step} of 3
          </h3>
          <button onClick={onClose} style={{ color: 'var(--text-muted)' }}>
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-5 py-4">
          {/* Step 1: Name & Description */}
          {step === 1 && (
            <div className="flex flex-col gap-3">
              <div>
                <label style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 500 }}>Server Name *</label>
                <input
                  style={inputStyle}
                  value={name}
                  onChange={e => setName(e.target.value.slice(0, 50))}
                  placeholder="My Awesome Server"
                  autoFocus
                />
                <p style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>{name.length}/50</p>
              </div>
              <div>
                <label style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 500 }}>Description</label>
                <textarea
                  style={{ ...inputStyle, resize: 'none', height: 60 }}
                  value={description}
                  onChange={e => setDescription(e.target.value.slice(0, 200))}
                  placeholder="What's this server about?"
                />
                <p style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>{description.length}/200</p>
              </div>
            </div>
          )}

          {/* Step 2: Icon & Banner */}
          {step === 2 && (
            <div className="flex flex-col gap-4">
              <div>
                <label style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 500 }}>Server Icon</label>
                <div
                  onClick={() => iconRef.current?.click()}
                  className="mt-1 flex items-center gap-3 cursor-pointer rounded-aero-lg p-3 transition-opacity hover:opacity-80"
                  style={{ border: '1px dashed var(--panel-divider)' }}
                >
                  {iconPreview ? (
                    <img src={iconPreview} alt="" style={{ width: 48, height: 48, borderRadius: 12, objectFit: 'cover' }} />
                  ) : (
                    <div style={{ width: 48, height: 48, borderRadius: 12, background: 'var(--input-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Upload className="h-4 w-4" style={{ color: 'var(--text-muted)' }} />
                    </div>
                  )}
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    {iconFile ? iconFile.name : 'Click to upload (optional)'}
                  </span>
                </div>
                <input ref={iconRef} type="file" accept="image/*" onChange={handleIconChange} hidden />
              </div>
              <div>
                <label style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 500 }}>Banner Image</label>
                <div
                  onClick={() => bannerRef.current?.click()}
                  className="mt-1 cursor-pointer overflow-hidden rounded-aero-lg transition-opacity hover:opacity-80"
                  style={{ border: '1px dashed var(--panel-divider)', height: 80 }}
                >
                  {bannerPreview ? (
                    <img src={bannerPreview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <div className="flex h-full items-center justify-center" style={{ background: 'var(--input-bg)' }}>
                      <Upload className="h-4 w-4" style={{ color: 'var(--text-muted)' }} />
                      <span className="ml-2" style={{ fontSize: 11, color: 'var(--text-muted)' }}>Upload banner (optional)</span>
                    </div>
                  )}
                </div>
                <input ref={bannerRef} type="file" accept="image/*" onChange={handleBannerChange} hidden />
              </div>
            </div>
          )}

          {/* Step 3: Member Cap & Preview */}
          {step === 3 && (
            <div className="flex flex-col gap-4">
              <div>
                <label style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 500 }}>Member Cap</label>
                <div className="flex items-center gap-3 mt-1">
                  <input
                    type="range"
                    min={1} max={200}
                    value={memberCap}
                    onChange={e => setMemberCap(Number(e.target.value))}
                    style={{ flex: 1 }}
                  />
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', minWidth: 32, textAlign: 'right' }}>
                    {memberCap}
                  </span>
                </div>
              </div>
              <div className="rounded-aero-lg p-3" style={{ background: 'var(--input-bg)', border: '1px solid var(--panel-divider)' }}>
                <p style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 500, marginBottom: 6 }}>
                  <Sparkles className="inline h-3 w-3 mr-1" style={{ color: '#00d4ff' }} />
                  What will be created:
                </p>
                <ul style={{ fontSize: 11, color: 'var(--text-muted)', listStyle: 'disc', paddingLeft: 16 }}>
                  <li>Server: <strong style={{ color: 'var(--text-primary)' }}>{name || '(unnamed)'}</strong></li>
                  <li>Your role: <strong style={{ color: '#ff6b35' }}>Owner</strong> (all permissions)</li>
                  <li>Default role: <strong style={{ color: '#8b949e' }}>Member</strong></li>
                  <li>Initial bubble: <strong style={{ color: '#00d4ff' }}>#general</strong></li>
                </ul>
              </div>
              {error && <p style={{ fontSize: 11, color: '#ff5032' }}>{error}</p>}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3" style={{ borderTop: '1px solid var(--panel-divider)' }}>
          {step > 1 ? (
            <button
              onClick={() => setStep(s => s - 1)}
              className="rounded-aero px-3 py-1.5 text-xs transition-opacity hover:opacity-70"
              style={{ color: 'var(--text-muted)' }}
            >
              Back
            </button>
          ) : <div />}

          {step < 3 ? (
            <div className="flex gap-2">
              {step === 2 && (
                <button
                  onClick={() => setStep(3)}
                  className="rounded-aero px-3 py-1.5 text-xs transition-opacity hover:opacity-70"
                  style={{ color: 'var(--text-muted)' }}
                >
                  Skip
                </button>
              )}
              <button
                onClick={() => setStep(s => s + 1)}
                disabled={step === 1 && !name.trim()}
                className="flex items-center gap-1 rounded-aero px-4 py-1.5 text-xs font-medium transition-opacity hover:opacity-90 disabled:opacity-40"
                style={{ background: 'rgba(0,212,255,0.15)', color: '#00d4ff', border: '1px solid rgba(0,212,255,0.3)' }}
              >
                Next <ArrowRight className="h-3 w-3" />
              </button>
            </div>
          ) : (
            <button
              onClick={handleCreate}
              disabled={creating || !name.trim()}
              className="rounded-aero px-4 py-1.5 text-xs font-medium transition-opacity hover:opacity-90 disabled:opacity-40"
              style={{ background: 'rgba(0,212,255,0.15)', color: '#00d4ff', border: '1px solid rgba(0,212,255,0.3)' }}
            >
              {creating ? 'Creating...' : 'Create Server'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
});
```

- [ ] **Step 2: Commit**

```bash
git add src/components/servers/CreateServerWizard.tsx
git commit -m "feat(servers): create 3-step server creation wizard"
```

---

### Task 6: Join Server Modal

**Files:**
- Create: `src/components/servers/JoinServerModal.tsx`

- [ ] **Step 1: Create the join-via-invite-code modal**

```tsx
// src/components/servers/JoinServerModal.tsx
import { memo, useState } from 'react';
import { X, ArrowRight } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';
import { useServerStore } from '../../store/serverStore';
import { useCornerStore } from '../../store/cornerStore';
import type { Server, ServerInvite } from '../../lib/serverTypes';

export const JoinServerModal = memo(function JoinServerModal({
  onClose,
}: {
  onClose: () => void;
}) {
  const user = useAuthStore(s => s.user);
  const { addServer, selectServer, loadServerData } = useServerStore();
  const { enterServer } = useCornerStore();

  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState<{ server: Server; invite: ServerInvite } | null>(null);

  const handleLookup = async () => {
    if (!code.trim()) return;
    setLoading(true);
    setError('');
    try {
      const { data: invite, error: iErr } = await supabase
        .from('server_invites')
        .select('*')
        .eq('code', code.trim())
        .single();
      if (iErr || !invite) throw new Error('Invite not found');

      if (invite.expires_at && new Date(invite.expires_at) < new Date()) throw new Error('This invite has expired');
      if (invite.max_uses && invite.use_count >= invite.max_uses) throw new Error('This invite has reached its use limit');

      const { data: server, error: sErr } = await supabase
        .from('servers')
        .select('*')
        .eq('id', invite.server_id)
        .single();
      if (sErr || !server) throw new Error('Server not found');

      setPreview({ server, invite });
    } catch (err: any) {
      setError(err.message ?? 'Invalid invite');
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async () => {
    if (!user || !preview) return;
    setLoading(true);
    setError('');
    try {
      // Find default Member role
      const { data: memberRole } = await supabase
        .from('server_roles')
        .select('id')
        .eq('server_id', preview.server.id)
        .eq('is_owner_role', false)
        .order('position', { ascending: true })
        .limit(1)
        .single();
      if (!memberRole) throw new Error('No member role found');

      // Insert membership
      const { error: mErr } = await supabase
        .from('server_members')
        .insert({ server_id: preview.server.id, user_id: user.id, role_id: memberRole.id });
      if (mErr) throw new Error(mErr.message.includes('duplicate') ? 'You are already a member' : mErr.message);

      // Increment use_count
      await supabase
        .from('server_invites')
        .update({ use_count: preview.invite.use_count + 1 })
        .eq('id', preview.invite.id);

      // Navigate
      addServer(preview.server);
      selectServer(preview.server.id);
      await loadServerData(preview.server.id);
      enterServer();
      onClose();
    } catch (err: any) {
      setError(err.message ?? 'Failed to join');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="animate-fade-in"
      style={{ position: 'fixed', inset: 0, zIndex: 60, backdropFilter: 'blur(24px)', background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ width: 400, borderRadius: 18, background: 'var(--sidebar-bg)', border: '1px solid var(--panel-divider)', overflow: 'hidden' }}>
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--panel-divider)' }}>
          <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Join a Server</h3>
          <button onClick={onClose} style={{ color: 'var(--text-muted)' }}><X className="h-4 w-4" /></button>
        </div>

        <div className="px-5 py-4">
          {!preview ? (
            <div className="flex flex-col gap-3">
              <label style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 500 }}>Invite Code</label>
              <div className="flex gap-2">
                <input
                  style={{
                    flex: 1, padding: '10px 12px', borderRadius: 10, fontSize: 13,
                    background: 'var(--input-bg)', border: '1px solid var(--input-border)',
                    color: 'var(--text-primary)', outline: 'none',
                  }}
                  value={code}
                  onChange={e => setCode(e.target.value)}
                  placeholder="Paste invite code..."
                  autoFocus
                  onKeyDown={e => e.key === 'Enter' && handleLookup()}
                />
                <button
                  onClick={handleLookup}
                  disabled={loading || !code.trim()}
                  className="flex items-center gap-1 rounded-aero px-3 py-1.5 text-xs font-medium disabled:opacity-40"
                  style={{ background: 'rgba(0,212,255,0.15)', color: '#00d4ff', border: '1px solid rgba(0,212,255,0.3)' }}
                >
                  {loading ? '...' : <><ArrowRight className="h-3 w-3" /> Look up</>}
                </button>
              </div>
              {error && <p style={{ fontSize: 11, color: '#ff5032' }}>{error}</p>}
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {/* Server preview */}
              <div className="overflow-hidden" style={{ borderRadius: 12, border: '1px solid var(--panel-divider)' }}>
                <div style={{ height: 60, background: preview.server.banner_url ? `url(${preview.server.banner_url}) center/cover` : 'linear-gradient(135deg, var(--sent-bubble-bg), var(--input-focus-border))' }} />
                <div className="p-3">
                  <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{preview.server.name}</p>
                  {preview.server.description && (
                    <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{preview.server.description}</p>
                  )}
                </div>
              </div>
              {error && <p style={{ fontSize: 11, color: '#ff5032' }}>{error}</p>}
              <button
                onClick={handleJoin}
                disabled={loading}
                className="w-full rounded-aero py-2 text-xs font-medium transition-opacity hover:opacity-90 disabled:opacity-40"
                style={{ background: 'rgba(0,212,255,0.15)', color: '#00d4ff', border: '1px solid rgba(0,212,255,0.3)' }}
              >
                {loading ? 'Joining...' : 'Join Server'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});
```

- [ ] **Step 2: Commit**

```bash
git add src/components/servers/JoinServerModal.tsx
git commit -m "feat(servers): create JoinServerModal — join via invite code"
```

---

### Task 7: ServerView Shell + Takeover Transition

**Files:**
- Create: `src/components/servers/ServerView.tsx`
- Modify: `src/components/chat/ChatLayout.tsx`

- [ ] **Step 1: Create ServerView shell**

This component is the full takeover container. It hosts the Bubble Hub, Bubble Chat, and Server Settings views.

```tsx
// src/components/servers/ServerView.tsx
import { memo, useEffect } from 'react';
import { ArrowLeft, Settings } from 'lucide-react';
import { useCornerStore } from '../../store/cornerStore';
import { useServerStore } from '../../store/serverStore';
import { useServerRoleStore } from '../../store/serverRoleStore';
import { BubbleHub } from './BubbleHub';
import { BubbleChat } from './BubbleChat';

export const ServerView = memo(function ServerView() {
  const { serverView, exitToDMs, exitToHub } = useCornerStore();
  const { selectedServerId, selectedBubbleId, servers, members, loadServerData } = useServerStore();
  const { loadRoles } = useServerRoleStore();

  const server = servers.find(s => s.id === selectedServerId);

  useEffect(() => {
    if (selectedServerId) {
      loadServerData(selectedServerId);
      loadRoles(selectedServerId);
    }
  }, [selectedServerId]);

  if (!server) return null;

  const initial = server.name.charAt(0).toUpperCase();

  return (
    <div className="flex h-full flex-col overflow-hidden" style={{ background: 'var(--chat-bg)' }}>
      {/* Header */}
      <div
        className="flex items-center px-4 py-3 flex-shrink-0"
        style={{ borderBottom: '1px solid var(--panel-divider)' }}
      >
        <button
          onClick={serverView === 'bubble' ? exitToHub : exitToDMs}
          className="flex items-center gap-1.5 text-xs transition-opacity hover:opacity-70"
          style={{ color: 'var(--text-muted)' }}
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {serverView === 'bubble' ? 'Hub' : 'Back to DMs'}
        </button>

        <div className="flex-1 flex items-center justify-center gap-2">
          <div style={{
            width: 24, height: 24, borderRadius: 6, flexShrink: 0,
            background: server.icon_url ? `url(${server.icon_url}) center/cover` : 'linear-gradient(135deg, var(--sent-bubble-bg), var(--input-focus-border))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 11, fontWeight: 700, color: 'white',
          }}>
            {!server.icon_url && initial}
          </div>
          <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            {server.name}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            {members.length} member{members.length !== 1 ? 's' : ''}
          </span>
          <button
            className="transition-opacity hover:opacity-70"
            style={{ color: 'var(--text-muted)' }}
          >
            <Settings className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="relative flex-1 min-h-0 overflow-hidden">
        {serverView === 'bubble' && selectedBubbleId ? (
          <BubbleChat />
        ) : (
          <BubbleHub />
        )}
      </div>
    </div>
  );
});
```

- [ ] **Step 2: Wire ServerOverlay + ServerView into ChatLayout**

In `src/components/chat/ChatLayout.tsx`, add the server takeover layer. This is the most important integration point.

Add imports at the top:

```tsx
import { ServerOverlay } from '../servers/ServerOverlay';
import { ServerView } from '../servers/ServerView';
import { CreateServerWizard } from '../servers/CreateServerWizard';
import { JoinServerModal } from '../servers/JoinServerModal';
```

Add state for wizard/join modals inside the `ChatLayout` component:

```tsx
const [showCreateWizard, setShowCreateWizard] = useState(false);
const [showJoinModal, setShowJoinModal] = useState(false);
```

Read `serverView` from cornerStore:

```tsx
const { gameViewActive, devViewActive, writerViewActive, calendarViewActive, serverView } = useCornerStore();
```

Update `anyViewActive` to also include server states:

```tsx
const anyViewActive = gameViewActive || devViewActive || writerViewActive || calendarViewActive;
const serverActive = serverView === 'server' || serverView === 'bubble';
```

Update the CHAT LAYER transform to also hide when server is active (full takeover means the entire DM layout disappears):

```tsx
transform: (anyViewActive || serverActive) ? 'translateX(-3%) scale(0.97)' : 'translateX(0) scale(1)',
opacity: (anyViewActive || serverActive) ? 0 : 1,
filter: serverActive ? 'blur(8px)' : 'none',
pointerEvents: (anyViewActive || serverActive) ? 'none' : 'auto',
```

After the DEV LAYER block and before the `{/* MINI CALL WIDGET */}` comment, add the SERVER LAYER:

```tsx
{/* ── SERVER LAYER (full takeover) ──────────────────────────── */}
<div
  style={{
    position: 'absolute', inset: 0,
    transform: serverActive ? 'scale(1)' : 'scale(1.05)',
    opacity: serverActive ? 1 : 0,
    transition: 'transform 0.4s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease',
    pointerEvents: serverActive ? 'auto' : 'none',
    borderRadius: 18, overflow: 'hidden',
  }}
>
  <ServerView />
</div>
```

After the closing `</div>` of the layer host (but still inside the `px-3 pb-3 gap-2` container), add the overlay and modals:

```tsx
{/* Server overlay + modals — rendered outside the layer host */}
{serverView === 'overlay' && (
  <ServerOverlay
    onCreateClick={() => setShowCreateWizard(true)}
    onJoinClick={() => setShowJoinModal(true)}
  />
)}
{showCreateWizard && <CreateServerWizard onClose={() => setShowCreateWizard(false)} />}
{showJoinModal && <JoinServerModal onClose={() => setShowJoinModal(false)} />}
```

- [ ] **Step 3: Verify**

Run: `cd aero-chat-app && pnpm build`

Expected: Build succeeds. Clicking the Servers icon opens the overlay. Creating a server triggers takeover transition.

- [ ] **Step 4: Commit**

```bash
git add src/components/servers/ServerView.tsx src/components/chat/ChatLayout.tsx
git commit -m "feat(servers): add ServerView shell + full takeover transition in ChatLayout"
```

---

### Task 8: Bubble Hub — Spatial Layout

**Files:**
- Create: `src/components/servers/BubbleHub.tsx`

- [ ] **Step 1: Create the spatial bubble layout**

```tsx
// src/components/servers/BubbleHub.tsx
import { memo, useState, useMemo, useCallback } from 'react';
import { Plus } from 'lucide-react';
import { useCornerStore } from '../../store/cornerStore';
import { useServerStore } from '../../store/serverStore';
import { useServerRoleStore } from '../../store/serverRoleStore';
import { useAuthStore } from '../../store/authStore';
import type { Bubble } from '../../lib/serverTypes';

// Distribute bubbles in a circle around center
function getBubblePositions(count: number, containerW: number, containerH: number) {
  const cx = containerW / 2;
  const cy = containerH / 2;
  const radius = Math.min(cx, cy) * 0.55;
  return Array.from({ length: count }, (_, i) => {
    const angle = (2 * Math.PI * i) / count - Math.PI / 2;
    return {
      x: cx + radius * Math.cos(angle),
      y: cy + radius * Math.sin(angle),
    };
  });
}

function BubbleCircle({ bubble, x, y, onClick }: {
  bubble: Bubble;
  x: number; y: number;
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const size = 80;

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="absolute cursor-pointer"
      style={{
        width: size, height: size, borderRadius: '50%',
        left: x - size / 2, top: y - size / 2,
        background: `${bubble.color}14`,
        backdropFilter: 'blur(4px)',
        border: `1.5px solid ${bubble.color}40`,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        transform: hovered ? 'scale(1.1)' : 'scale(1)',
        boxShadow: hovered ? `0 0 20px ${bubble.color}30` : 'none',
        transition: 'transform 0.2s, box-shadow 0.2s',
      }}
    >
      <span style={{ fontSize: 12, fontWeight: 500, color: bubble.color }}>{bubble.name}</span>
    </div>
  );
}

export const BubbleHub = memo(function BubbleHub() {
  const { selectBubble } = useServerStore();
  const { enterBubble } = useCornerStore();
  const bubbles = useServerStore(s => s.bubbles);
  const server = useServerStore(s => s.servers.find(sv => sv.id === s.selectedServerId));
  const user = useAuthStore(s => s.user);
  const members = useServerStore(s => s.members);
  const { hasPermission } = useServerRoleStore();

  const canManageBubbles = user && server
    ? hasPermission(server.id, user.id, members, 'manage_bubbles')
    : false;

  const handleBubbleClick = useCallback((bubble: Bubble) => {
    selectBubble(bubble.id);
    enterBubble();
  }, []);

  // Use a fixed 800x500 virtual space for positioning
  const W = 800, H = 500;
  const positions = useMemo(() => getBubblePositions(bubbles.length, W, H), [bubbles.length]);

  const initial = server?.name.charAt(0).toUpperCase() ?? '?';

  return (
    <div className="relative h-full w-full overflow-hidden">
      {/* Background orbs */}
      <div className="pointer-events-none absolute inset-0">
        <div className="orb" style={{ width: 200, height: 200, left: '5%', top: '5%', background: 'radial-gradient(circle, rgba(0,180,255,0.08) 0%, transparent 70%)', animation: 'orb-drift 8s ease-in-out infinite' }} />
        <div className="orb" style={{ width: 160, height: 160, right: '8%', bottom: '10%', background: 'radial-gradient(circle, rgba(120,0,255,0.06) 0%, transparent 70%)', animation: 'orb-drift 7s ease-in-out 2s infinite' }} />
      </div>

      {/* Bubble area — centered with aspect ratio */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div style={{ position: 'relative', width: W, height: H, maxWidth: '95%', maxHeight: '90%' }}>

          {/* Center server icon */}
          <div
            className="absolute"
            style={{
              left: W / 2 - 32, top: H / 2 - 32,
              width: 64, height: 64, borderRadius: 18,
              background: server?.icon_url
                ? `url(${server.icon_url}) center/cover`
                : 'linear-gradient(135deg, var(--sent-bubble-bg), var(--input-focus-border))',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 24, fontWeight: 700, color: 'white',
              boxShadow: '0 0 30px rgba(0,212,255,0.25)',
              zIndex: 2,
            }}
          >
            {!server?.icon_url && initial}
          </div>

          {/* Bubbles */}
          {bubbles.map((bubble, i) => (
            <BubbleCircle
              key={bubble.id}
              bubble={bubble}
              x={positions[i]?.x ?? 0}
              y={positions[i]?.y ?? 0}
              onClick={() => handleBubbleClick(bubble)}
            />
          ))}

          {/* Add bubble button */}
          {canManageBubbles && (
            <div
              className="absolute cursor-pointer"
              style={{
                right: 20, bottom: 20,
                width: 42, height: 42, borderRadius: '50%',
                border: '1.5px dashed var(--panel-divider)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'opacity 0.2s',
              }}
            >
              <Plus className="h-4 w-4" style={{ color: 'var(--text-muted)' }} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
});
```

- [ ] **Step 2: Commit**

```bash
git add src/components/servers/BubbleHub.tsx
git commit -m "feat(servers): create BubbleHub — spatial floating bubble layout"
```

---

### Task 9: Bubble Chat — Messages + Realtime

**Files:**
- Create: `src/components/servers/BubbleChat.tsx`
- Create: `src/components/servers/BubbleCallBanner.tsx`

- [ ] **Step 1: Create BubbleCallBanner**

```tsx
// src/components/servers/BubbleCallBanner.tsx
import { memo } from 'react';
import { Phone } from 'lucide-react';

export const BubbleCallBanner = memo(function BubbleCallBanner({
  participantCount,
  onJoin,
}: {
  participantCount: number;
  onJoin: () => void;
}) {
  return (
    <div
      className="mx-3 mt-2 flex items-center gap-3 rounded-aero-lg px-3.5 py-2"
      style={{
        background: 'linear-gradient(135deg, rgba(79,201,122,0.1), rgba(0,212,255,0.08))',
        border: '1px solid rgba(79,201,122,0.2)',
      }}
    >
      <div
        style={{
          width: 8, height: 8, borderRadius: '50%',
          background: '#4fc97a',
          boxShadow: '0 0 6px rgba(79,201,122,0.5)',
          animation: 'aura-pulse 2s ease-in-out infinite',
        }}
      />
      <span style={{ fontSize: 12, fontWeight: 500, color: '#4fc97a' }}>Call active</span>
      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{participantCount} in call</span>
      <button
        onClick={onJoin}
        className="ml-auto flex items-center gap-1 rounded-aero px-3 py-1 text-xs font-medium transition-opacity hover:opacity-80"
        style={{
          background: 'rgba(79,201,122,0.15)',
          border: '1px solid rgba(79,201,122,0.3)',
          color: '#4fc97a',
        }}
      >
        <Phone className="h-3 w-3" /> Join
      </button>
    </div>
  );
});
```

- [ ] **Step 2: Create BubbleChat**

```tsx
// src/components/servers/BubbleChat.tsx
import { memo, useState, useRef, useEffect, useCallback } from 'react';
import { Send } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';
import { useServerStore } from '../../store/serverStore';
import { useServerMessageStore } from '../../store/serverMessageStore';
import { useServerRoleStore } from '../../store/serverRoleStore';
import { AvatarImage } from '../ui/AvatarImage';
import type { BubbleMessage } from '../../lib/serverTypes';

export const BubbleChat = memo(function BubbleChat() {
  const user = useAuthStore(s => s.user);
  const { selectedBubbleId, selectedServerId, bubbles, members } = useServerStore();
  const { roles } = useServerRoleStore();
  const { bubbles: msgCache, setBubble, appendMessage } = useServerMessageStore();

  const bubble = bubbles.find(b => b.id === selectedBubbleId);
  const messages = msgCache[selectedBubbleId ?? ''] ?? [];
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Load messages on mount
  useEffect(() => {
    if (!selectedBubbleId) return;
    (async () => {
      const { data } = await supabase
        .from('bubble_messages')
        .select('*')
        .eq('bubble_id', selectedBubbleId)
        .order('created_at', { ascending: true })
        .limit(200);
      if (data) setBubble(selectedBubbleId, data);
    })();
  }, [selectedBubbleId]);

  // Realtime subscription
  useEffect(() => {
    if (!selectedBubbleId) return;
    const channel = supabase
      .channel(`bubble:${selectedBubbleId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'bubble_messages',
        filter: `bubble_id=eq.${selectedBubbleId}`,
      }, (payload) => {
        const msg = payload.new as BubbleMessage;
        appendMessage(selectedBubbleId, msg);
      })
      .subscribe();
    channelRef.current = channel;
    return () => { supabase.removeChannel(channel); };
  }, [selectedBubbleId]);

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const handleSend = useCallback(async () => {
    if (!input.trim() || !user || !selectedBubbleId || sending) return;
    const text = input.trim();
    setInput('');
    setSending(true);
    await supabase.from('bubble_messages').insert({
      bubble_id: selectedBubbleId,
      sender_id: user.id,
      content: text,
    });
    setSending(false);
  }, [input, user, selectedBubbleId, sending]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  // Helper to get member info + role for a sender
  const getSenderInfo = (senderId: string) => {
    const member = members.find(m => m.user_id === senderId);
    const role = member ? roles.find(r => r.id === member.role_id) : null;
    return { username: member?.username ?? 'Unknown', avatarUrl: member?.avatar_url, role };
  };

  if (!bubble) return null;

  return (
    <div className="flex h-full flex-col">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3" style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ flex: 1 }} />
        {messages.map((msg) => {
          const { username, avatarUrl, role } = getSenderInfo(msg.sender_id);
          const isMine = msg.sender_id === user?.id;
          return (
            <div key={msg.id} className="flex gap-2.5 py-1.5" style={{ alignItems: 'flex-start' }}>
              <AvatarImage username={username} avatarUrl={avatarUrl} size="sm" />
              <div style={{ minWidth: 0 }}>
                <div className="flex items-center gap-1.5">
                  <span style={{ fontSize: 12, fontWeight: 500, color: role?.color ?? 'var(--text-primary)' }}>
                    {username}
                  </span>
                  {role && !role.is_owner_role && role.position > 1 && (
                    <span style={{
                      fontSize: 9, padding: '1px 5px', borderRadius: 4,
                      background: `${role.color}20`, color: role.color,
                    }}>
                      {role.name}
                    </span>
                  )}
                  {role?.is_owner_role && (
                    <span style={{
                      fontSize: 9, padding: '1px 5px', borderRadius: 4,
                      background: `${role.color}20`, color: role.color,
                    }}>
                      Owner
                    </span>
                  )}
                  <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>
                    {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <p style={{ fontSize: 13, color: 'var(--text-primary)', marginTop: 2, wordBreak: 'break-word' }}>
                  {msg.content}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="flex-shrink-0 px-3 pb-3">
        <div
          className="flex items-center gap-2 rounded-aero-lg px-3"
          style={{
            background: 'var(--input-bg)',
            border: '1px solid var(--input-border)',
          }}
        >
          <input
            className="flex-1 bg-transparent py-2.5 text-sm outline-none"
            style={{ color: 'var(--text-primary)' }}
            placeholder={`Message #${bubble.name}...`}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || sending}
            className="transition-opacity hover:opacity-70 disabled:opacity-30"
            style={{ color: '#00d4ff' }}
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
});
```

- [ ] **Step 3: Commit**

```bash
git add src/components/servers/BubbleChat.tsx src/components/servers/BubbleCallBanner.tsx
git commit -m "feat(servers): create BubbleChat + BubbleCallBanner — messages, realtime, input"
```

---

### Task 10: Server Settings

**Files:**
- Create: `src/components/servers/ServerSettings.tsx`
- Create: `src/components/servers/RoleEditor.tsx`
- Create: `src/components/servers/MemberList.tsx`
- Create: `src/components/servers/BubbleManager.tsx`
- Create: `src/components/servers/InviteManager.tsx`

This is a large task with 5 files. Each file is a tab within the ServerSettings panel.

- [ ] **Step 1: Create RoleEditor**

```tsx
// src/components/servers/RoleEditor.tsx
import { memo, useState } from 'react';
import { Plus, Trash2, Save } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useServerStore } from '../../store/serverStore';
import { useServerRoleStore } from '../../store/serverRoleStore';
import { useAuthStore } from '../../store/authStore';
import type { PermissionKey } from '../../lib/serverTypes';

const PERM_LABELS: Record<PermissionKey, string> = {
  manage_server: 'Manage Server',
  manage_roles: 'Manage Roles',
  manage_bubbles: 'Manage Bubbles',
  manage_members: 'Manage Members',
  send_invites: 'Send Invites',
  send_messages: 'Send Messages',
  pin_messages: 'Pin Messages',
  start_calls: 'Start Calls',
};

export const RoleEditor = memo(function RoleEditor() {
  const user = useAuthStore(s => s.user);
  const { selectedServerId, members } = useServerStore();
  const { roles, loadRoles } = useServerRoleStore();
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState('#00d4ff');

  const myMembership = members.find(m => m.user_id === user?.id);
  const myRole = myMembership ? roles.find(r => r.id === myMembership.role_id) : null;
  const myPosition = myRole?.position ?? -1;

  const handleCreateRole = async () => {
    if (!selectedServerId || !newName.trim()) return;
    const position = 2; // just above default Member
    const { data: role } = await supabase
      .from('server_roles')
      .insert({ server_id: selectedServerId, name: newName.trim(), color: newColor, position })
      .select()
      .single();
    if (role) {
      await supabase.from('server_role_permissions').insert({ role_id: role.id });
      await loadRoles(selectedServerId);
      setNewName('');
    }
  };

  const handleTogglePerm = async (roleId: string, perm: PermissionKey, current: boolean) => {
    await supabase.from('server_role_permissions').update({ [perm]: !current }).eq('role_id', roleId);
    if (selectedServerId) await loadRoles(selectedServerId);
  };

  const handleDeleteRole = async (roleId: string) => {
    await supabase.from('server_roles').delete().eq('id', roleId);
    if (selectedServerId) await loadRoles(selectedServerId);
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Create new role */}
      <div className="flex items-center gap-2">
        <input
          className="flex-1 rounded-aero px-3 py-1.5 text-xs"
          style={{ background: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--text-primary)', outline: 'none' }}
          placeholder="New role name..."
          value={newName}
          onChange={e => setNewName(e.target.value)}
        />
        <input type="color" value={newColor} onChange={e => setNewColor(e.target.value)} style={{ width: 28, height: 28, border: 'none', cursor: 'pointer' }} />
        <button
          onClick={handleCreateRole}
          disabled={!newName.trim()}
          className="flex items-center gap-1 rounded-aero px-3 py-1.5 text-xs disabled:opacity-40"
          style={{ background: 'rgba(0,212,255,0.12)', color: '#00d4ff' }}
        >
          <Plus className="h-3 w-3" /> Add
        </button>
      </div>

      {/* Role list */}
      {roles.map(role => (
        <div key={role.id} className="rounded-aero-lg p-3" style={{ border: '1px solid var(--panel-divider)' }}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div style={{ width: 12, height: 12, borderRadius: '50%', background: role.color }} />
              <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>{role.name}</span>
              <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>pos: {role.position}</span>
            </div>
            {!role.is_owner_role && role.position < myPosition && (
              <button onClick={() => handleDeleteRole(role.id)} className="transition-opacity hover:opacity-70" style={{ color: '#ff5032' }}>
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          {!role.is_owner_role && role.position < myPosition && (
            <div className="grid grid-cols-2 gap-1.5">
              {(Object.keys(PERM_LABELS) as PermissionKey[]).map(perm => (
                <label key={perm} className="flex items-center gap-1.5 cursor-pointer" style={{ fontSize: 10, color: 'var(--text-secondary)' }}>
                  <input
                    type="checkbox"
                    checked={role.permissions[perm]}
                    onChange={() => handleTogglePerm(role.id, perm, role.permissions[perm])}
                    style={{ accentColor: role.color }}
                  />
                  {PERM_LABELS[perm]}
                </label>
              ))}
            </div>
          )}
          {role.is_owner_role && (
            <p style={{ fontSize: 10, color: 'var(--text-muted)' }}>Owner role — all permissions, cannot be edited</p>
          )}
        </div>
      ))}
    </div>
  );
});
```

- [ ] **Step 2: Create MemberList**

```tsx
// src/components/servers/MemberList.tsx
import { memo } from 'react';
import { UserMinus } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useServerStore } from '../../store/serverStore';
import { useServerRoleStore } from '../../store/serverRoleStore';
import { useAuthStore } from '../../store/authStore';
import { AvatarImage } from '../ui/AvatarImage';

export const MemberList = memo(function MemberList() {
  const user = useAuthStore(s => s.user);
  const { selectedServerId, members, loadServerData } = useServerStore();
  const { roles, hasPermission } = useServerRoleStore();

  const canManage = user && selectedServerId
    ? hasPermission(selectedServerId, user.id, members, 'manage_members')
    : false;

  const myMembership = members.find(m => m.user_id === user?.id);
  const myRole = myMembership ? roles.find(r => r.id === myMembership.role_id) : null;
  const myPosition = myRole?.position ?? -1;

  const handleKick = async (userId: string) => {
    if (!selectedServerId) return;
    await supabase.from('server_members').delete().eq('server_id', selectedServerId).eq('user_id', userId);
    await loadServerData(selectedServerId);
  };

  const handleRoleChange = async (userId: string, roleId: string) => {
    if (!selectedServerId) return;
    await supabase.from('server_members').update({ role_id: roleId }).eq('server_id', selectedServerId).eq('user_id', userId);
    await loadServerData(selectedServerId);
  };

  return (
    <div className="flex flex-col gap-2">
      {members.map(member => {
        const role = roles.find(r => r.id === member.role_id);
        const memberPosition = role?.position ?? 0;
        const canEdit = canManage && memberPosition < myPosition && member.user_id !== user?.id;

        return (
          <div key={member.user_id} className="flex items-center gap-3 rounded-aero px-3 py-2" style={{ border: '1px solid var(--panel-divider)' }}>
            <AvatarImage username={member.username ?? '?'} avatarUrl={member.avatar_url} size="sm" />
            <div className="flex-1 min-w-0">
              <p className="truncate text-xs font-medium" style={{ color: 'var(--text-primary)' }}>{member.username}</p>
              <div className="flex items-center gap-1 mt-0.5">
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: role?.color }} />
                <span style={{ fontSize: 9, color: role?.color }}>{role?.name}</span>
              </div>
            </div>
            {canEdit && (
              <div className="flex items-center gap-2">
                <select
                  value={member.role_id}
                  onChange={e => handleRoleChange(member.user_id, e.target.value)}
                  className="rounded-aero px-2 py-1 text-xs"
                  style={{ background: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--text-primary)', outline: 'none' }}
                >
                  {roles.filter(r => r.position < myPosition && !r.is_owner_role).map(r => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
                <button onClick={() => handleKick(member.user_id)} className="transition-opacity hover:opacity-70" style={{ color: '#ff5032' }}>
                  <UserMinus className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
});
```

- [ ] **Step 3: Create BubbleManager**

```tsx
// src/components/servers/BubbleManager.tsx
import { memo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useServerStore } from '../../store/serverStore';
import { useServerRoleStore } from '../../store/serverRoleStore';

export const BubbleManager = memo(function BubbleManager() {
  const { selectedServerId, bubbles, loadServerData } = useServerStore();
  const { roles } = useServerRoleStore();
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState('#00d4ff');

  const handleCreate = async () => {
    if (!selectedServerId || !newName.trim()) return;
    await supabase.from('bubbles').insert({
      server_id: selectedServerId, name: newName.trim(), color: newColor, restricted_to_roles: [],
    });
    await loadServerData(selectedServerId);
    setNewName('');
  };

  const handleDelete = async (bubbleId: string) => {
    await supabase.from('bubbles').delete().eq('id', bubbleId);
    if (selectedServerId) await loadServerData(selectedServerId);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <input
          className="flex-1 rounded-aero px-3 py-1.5 text-xs"
          style={{ background: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--text-primary)', outline: 'none' }}
          placeholder="New bubble name..."
          value={newName}
          onChange={e => setNewName(e.target.value)}
        />
        <input type="color" value={newColor} onChange={e => setNewColor(e.target.value)} style={{ width: 28, height: 28, border: 'none', cursor: 'pointer' }} />
        <button
          onClick={handleCreate}
          disabled={!newName.trim()}
          className="flex items-center gap-1 rounded-aero px-3 py-1.5 text-xs disabled:opacity-40"
          style={{ background: 'rgba(0,212,255,0.12)', color: '#00d4ff' }}
        >
          <Plus className="h-3 w-3" /> Add
        </button>
      </div>

      {bubbles.map(bubble => (
        <div key={bubble.id} className="flex items-center gap-3 rounded-aero px-3 py-2" style={{ border: '1px solid var(--panel-divider)' }}>
          <div style={{ width: 12, height: 12, borderRadius: '50%', background: bubble.color }} />
          <span className="flex-1 text-xs" style={{ color: 'var(--text-primary)' }}>{bubble.name}</span>
          <button onClick={() => handleDelete(bubble.id)} className="transition-opacity hover:opacity-70" style={{ color: '#ff5032' }}>
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
});
```

- [ ] **Step 4: Create InviteManager**

```tsx
// src/components/servers/InviteManager.tsx
import { memo, useState, useEffect } from 'react';
import { Copy, Trash2, Plus } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useServerStore } from '../../store/serverStore';
import { useAuthStore } from '../../store/authStore';
import type { ServerInvite } from '../../lib/serverTypes';

function generateCode(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(6)))
    .map(b => b.toString(36).padStart(2, '0'))
    .join('')
    .slice(0, 8);
}

export const InviteManager = memo(function InviteManager() {
  const user = useAuthStore(s => s.user);
  const { selectedServerId } = useServerStore();
  const [invites, setInvites] = useState<ServerInvite[]>([]);
  const [expiry, setExpiry] = useState<string>('24h');
  const [maxUses, setMaxUses] = useState<string>('unlimited');
  const [copied, setCopied] = useState<string | null>(null);

  const loadInvites = async () => {
    if (!selectedServerId) return;
    const { data } = await supabase
      .from('server_invites')
      .select('*')
      .eq('server_id', selectedServerId)
      .order('created_at', { ascending: false });
    if (data) setInvites(data);
  };

  useEffect(() => { loadInvites(); }, [selectedServerId]);

  const handleCreate = async () => {
    if (!selectedServerId || !user) return;
    const expiryMap: Record<string, string | null> = {
      '1h': new Date(Date.now() + 3600000).toISOString(),
      '24h': new Date(Date.now() + 86400000).toISOString(),
      '7d': new Date(Date.now() + 604800000).toISOString(),
      'never': null,
    };
    const usesMap: Record<string, number | null> = {
      '1': 1, '10': 10, '50': 50, 'unlimited': null,
    };
    await supabase.from('server_invites').insert({
      server_id: selectedServerId,
      created_by: user.id,
      code: generateCode(),
      expires_at: expiryMap[expiry],
      max_uses: usesMap[maxUses],
    });
    await loadInvites();
  };

  const handleRevoke = async (id: string) => {
    await supabase.from('server_invites').delete().eq('id', id);
    await loadInvites();
  };

  const handleCopy = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopied(code);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Create invite */}
      <div className="flex items-center gap-2 flex-wrap">
        <select value={expiry} onChange={e => setExpiry(e.target.value)}
          className="rounded-aero px-2 py-1.5 text-xs"
          style={{ background: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--text-primary)' }}>
          <option value="1h">Expires: 1 hour</option>
          <option value="24h">Expires: 24 hours</option>
          <option value="7d">Expires: 7 days</option>
          <option value="never">Never expires</option>
        </select>
        <select value={maxUses} onChange={e => setMaxUses(e.target.value)}
          className="rounded-aero px-2 py-1.5 text-xs"
          style={{ background: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--text-primary)' }}>
          <option value="1">Max: 1 use</option>
          <option value="10">Max: 10 uses</option>
          <option value="50">Max: 50 uses</option>
          <option value="unlimited">Unlimited</option>
        </select>
        <button onClick={handleCreate}
          className="flex items-center gap-1 rounded-aero px-3 py-1.5 text-xs"
          style={{ background: 'rgba(0,212,255,0.12)', color: '#00d4ff' }}>
          <Plus className="h-3 w-3" /> Generate
        </button>
      </div>

      {/* Invite list */}
      {invites.map(inv => (
        <div key={inv.id} className="flex items-center gap-3 rounded-aero px-3 py-2" style={{ border: '1px solid var(--panel-divider)' }}>
          <code className="flex-1 text-xs font-mono" style={{ color: 'var(--text-primary)' }}>{inv.code}</code>
          <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>
            {inv.use_count}{inv.max_uses ? `/${inv.max_uses}` : ''} uses
          </span>
          <button onClick={() => handleCopy(inv.code)} className="transition-opacity hover:opacity-70" style={{ color: '#00d4ff' }}>
            <Copy className="h-3.5 w-3.5" />
          </button>
          <button onClick={() => handleRevoke(inv.id)} className="transition-opacity hover:opacity-70" style={{ color: '#ff5032' }}>
            <Trash2 className="h-3.5 w-3.5" />
          </button>
          {copied === inv.code && <span style={{ fontSize: 9, color: '#4fc97a' }}>Copied!</span>}
        </div>
      ))}
      {invites.length === 0 && (
        <p style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', padding: 12 }}>No active invites</p>
      )}
    </div>
  );
});
```

- [ ] **Step 5: Create ServerSettings — the tabbed panel that hosts all management components**

```tsx
// src/components/servers/ServerSettings.tsx
import { memo, useState } from 'react';
import { X } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useServerStore } from '../../store/serverStore';
import { useServerRoleStore } from '../../store/serverRoleStore';
import { RoleEditor } from './RoleEditor';
import { MemberList } from './MemberList';
import { BubbleManager } from './BubbleManager';
import { InviteManager } from './InviteManager';

type Tab = 'roles' | 'members' | 'bubbles' | 'invites';

export const ServerSettings = memo(function ServerSettings({
  onClose,
}: {
  onClose: () => void;
}) {
  const [tab, setTab] = useState<Tab>('roles');
  const user = useAuthStore(s => s.user);
  const { selectedServerId, members } = useServerStore();
  const { hasPermission } = useServerRoleStore();

  const can = (perm: string) =>
    user && selectedServerId
      ? hasPermission(selectedServerId, user.id, members, perm as any)
      : false;

  const tabs: { id: Tab; label: string; show: boolean }[] = [
    { id: 'roles', label: 'Roles', show: can('manage_roles') },
    { id: 'members', label: 'Members', show: true },
    { id: 'bubbles', label: 'Bubbles', show: can('manage_bubbles') },
    { id: 'invites', label: 'Invites', show: can('send_invites') },
  ];

  const visibleTabs = tabs.filter(t => t.show);

  return (
    <div
      className="animate-fade-in"
      style={{ position: 'fixed', inset: 0, zIndex: 55, backdropFilter: 'blur(20px)', background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ width: 560, maxHeight: '80vh', borderRadius: 18, background: 'var(--sidebar-bg)', border: '1px solid var(--panel-divider)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 flex-shrink-0" style={{ borderBottom: '1px solid var(--panel-divider)' }}>
          <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Server Settings</h3>
          <button onClick={onClose} style={{ color: 'var(--text-muted)' }}><X className="h-4 w-4" /></button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-5 py-2 flex-shrink-0" style={{ borderBottom: '1px solid var(--panel-divider)' }}>
          {visibleTabs.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className="rounded-aero px-3 py-1.5 text-xs font-medium transition-all"
              style={{
                background: tab === t.id ? 'rgba(0,212,255,0.12)' : 'transparent',
                color: tab === t.id ? '#00d4ff' : 'var(--text-muted)',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {tab === 'roles' && <RoleEditor />}
          {tab === 'members' && <MemberList />}
          {tab === 'bubbles' && <BubbleManager />}
          {tab === 'invites' && <InviteManager />}
        </div>
      </div>
    </div>
  );
});
```

- [ ] **Step 6: Wire settings button in ServerView**

In `src/components/servers/ServerView.tsx`, add state for settings and import `ServerSettings`:

```tsx
import { ServerSettings } from './ServerSettings';
```

Add state:

```tsx
const [settingsOpen, setSettingsOpen] = useState(false);
```

Wire the gear button's `onClick`:

```tsx
<button
  onClick={() => setSettingsOpen(true)}
  className="transition-opacity hover:opacity-70"
  style={{ color: 'var(--text-muted)' }}
>
  <Settings className="h-4 w-4" />
</button>
```

Add at the end of the component, before the closing `</div>`:

```tsx
{settingsOpen && <ServerSettings onClose={() => setSettingsOpen(false)} />}
```

Add `useState` to the import.

- [ ] **Step 7: Commit**

```bash
git add src/components/servers/ServerSettings.tsx src/components/servers/RoleEditor.tsx src/components/servers/MemberList.tsx src/components/servers/BubbleManager.tsx src/components/servers/InviteManager.tsx src/components/servers/ServerView.tsx
git commit -m "feat(servers): create ServerSettings panel — roles, members, bubbles, invites"
```

---

### Task 11: Global Realtime — Server Invite Notifications

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Add server_invites channel subscription**

In `src/App.tsx`, import the server store:

```tsx
import { useServerStore } from './store/serverStore';
```

Inside the component, after the existing `loadFriends` / `subscribeToRequests` destructuring, add:

```tsx
const { loadServers } = useServerStore();
```

After the existing `// Global unread counter` useEffect block, add a new effect for loading servers on login:

```tsx
// Load user's servers on login
useEffect(() => {
  if (!user) return;
  loadServers();
}, [user?.id]);
```

- [ ] **Step 2: Commit**

```bash
git add src/App.tsx
git commit -m "feat(servers): load servers on login in App.tsx"
```

---

### Task 12: Build Verification & Deploy

- [ ] **Step 1: Verify TypeScript compiles**

Run: `cd aero-chat-app && pnpm build`

Expected: Build succeeds with no type errors. The main bundle should not grow significantly (servers components are not lazy-loaded yet but are tree-shaken if unused).

- [ ] **Step 2: Manual verification on localhost**

Run: `cd aero-chat-app && pnpm dev`

Test checklist:
1. Servers globe icon visible in Corner Rail
2. Clicking it opens blur overlay (empty state — "No servers yet")
3. Clicking "+ Create" opens wizard: name → icon/banner → member cap → creates server
4. After creation, full takeover transition to Bubble Hub
5. "general" bubble visible as floating circle
6. Clicking bubble zooms into chat view
7. Sending a message in the bubble works (appears in real time)
8. "← Hub" returns to Bubble Hub
9. "← Back to DMs" returns to normal DM view
10. Settings gear opens ServerSettings panel
11. Can create new roles and bubbles from settings

- [ ] **Step 3: Push to GitHub**

```bash
cd aero-chat-app && git push origin main
```

- [ ] **Step 4: Deploy to Vercel**

```bash
cd aero-chat-app && vercel --prod --yes
```

---

## Verification Summary

| Feature | How to verify |
|---------|---------------|
| Database tables | Supabase dashboard → Table Editor — all 7 tables present |
| RLS | Try querying as non-member — should get empty results |
| Corner Rail icon | Globe icon with unread badge visible |
| Server overlay | Blur backdrop, 5-per-row grid, Create/Join buttons |
| Create wizard | 3 steps, creates server + Owner role + Member role + general bubble |
| Takeover transition | DM world fades/blurs, server world scales in |
| Bubble Hub | Floating circles around center server icon |
| Zoom transition | Bubble click → scales up to chat view |
| Bubble chat | Messages render with avatars + role badges, realtime works |
| Server settings | Roles, members, bubbles, invites tabs all functional |
| Join via invite | Code lookup → preview → join → enters server |
| Back navigation | Hub → DMs, Bubble → Hub — both work |
