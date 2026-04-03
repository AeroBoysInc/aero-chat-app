-- 015_fix_calendar_rls_circular.sql
-- Fix circular RLS dependency between calendar_events and calendar_event_invites.
-- events_invitee_select referenced calendar_event_invites, whose invites_select
-- referenced calendar_events back — causing infinite recursion → 500 on any query.

-- ── Helper function with SECURITY DEFINER to bypass RLS on invites lookup ───
CREATE OR REPLACE FUNCTION public.is_event_invitee(event_uuid UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.calendar_event_invites
    WHERE event_id = event_uuid AND invitee_id = auth.uid()
  );
$$;

-- ── Fix calendar_events: replace events_invitee_select to use the helper ────
DROP POLICY IF EXISTS "events_invitee_select" ON public.calendar_events;
CREATE POLICY "events_invitee_select" ON public.calendar_events FOR SELECT
  USING (
    visibility = 'invited' AND public.is_event_invitee(id)
  );

-- ── Fix calendar_event_invites: split invites_select into two policies ───────
DROP POLICY IF EXISTS "invites_select" ON public.calendar_event_invites;

-- Invitees can see their own invite rows
CREATE POLICY "invites_invitee_select" ON public.calendar_event_invites FOR SELECT
  USING (invitee_id = auth.uid());

-- Event creators can see invite rows for their events
CREATE POLICY "invites_creator_select" ON public.calendar_event_invites FOR SELECT
  USING (
    event_id IN (
      SELECT id FROM public.calendar_events WHERE creator_id = auth.uid()
    )
  );
