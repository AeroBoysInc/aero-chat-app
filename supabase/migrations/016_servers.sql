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
