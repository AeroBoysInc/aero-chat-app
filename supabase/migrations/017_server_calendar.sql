-- 017_server_calendar.sql
-- ── Link calendar events to servers ─────────────────────────────────────────

-- Add nullable server_id to calendar_events
ALTER TABLE public.calendar_events
  ADD COLUMN IF NOT EXISTS server_id UUID REFERENCES public.servers(id) ON DELETE CASCADE;

-- Server members can see events for their servers
CREATE POLICY "events_server_member_select" ON public.calendar_events FOR SELECT
  USING (
    server_id IS NOT NULL
    AND is_server_member(server_id)
  );

-- Server members with manage_server permission can create server events
CREATE POLICY "events_server_insert" ON public.calendar_events FOR INSERT
  WITH CHECK (
    server_id IS NOT NULL
    AND creator_id = auth.uid()
    AND is_server_member(server_id)
  );

-- Creator can update/delete their own server events
CREATE POLICY "events_server_update" ON public.calendar_events FOR UPDATE
  USING (
    server_id IS NOT NULL
    AND creator_id = auth.uid()
  );

CREATE POLICY "events_server_delete" ON public.calendar_events FOR DELETE
  USING (
    server_id IS NOT NULL
    AND creator_id = auth.uid()
  );
