-- 020_fix_bubble_rls_owner.sql
-- Fix bubble RLS policies to include owner fallback on SELECT, UPDATE, DELETE.
-- The INSERT policy already had this, but the others were missing it,
-- causing 403 errors when the owner tried to update bubble settings.

-- ── SELECT: owner should always see all bubbles in their server ─────────────
DROP POLICY IF EXISTS "bubbles_member_select" ON public.bubbles;
CREATE POLICY "bubbles_member_select" ON public.bubbles FOR SELECT
  USING (
    -- Owner can always see every bubble
    EXISTS (SELECT 1 FROM public.servers s WHERE s.id = server_id AND s.owner_id = auth.uid())
    OR (
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
    )
  );

-- ── UPDATE: add owner fallback ──────────────────────────────────────────────
DROP POLICY IF EXISTS "bubbles_manage_update" ON public.bubbles;
CREATE POLICY "bubbles_manage_update" ON public.bubbles FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM public.servers s WHERE s.id = server_id AND s.owner_id = auth.uid())
    OR has_server_permission(server_id, 'manage_bubbles')
  );

-- ── DELETE: add owner fallback ──────────────────────────────────────────────
DROP POLICY IF EXISTS "bubbles_manage_delete" ON public.bubbles;
CREATE POLICY "bubbles_manage_delete" ON public.bubbles FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM public.servers s WHERE s.id = server_id AND s.owner_id = auth.uid())
    OR has_server_permission(server_id, 'manage_bubbles')
  );
