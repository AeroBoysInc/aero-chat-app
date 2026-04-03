-- 014_calendar.sql
-- ── Calendar events ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS calendar_events (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id   UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title        TEXT        NOT NULL,
  description  TEXT,
  start_at     TIMESTAMPTZ NOT NULL,
  end_at       TIMESTAMPTZ NOT NULL,
  color        TEXT        NOT NULL DEFAULT '#00d4ff',
  visibility   TEXT        NOT NULL DEFAULT 'private'
                           CHECK (visibility IN ('private','invited')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "events_owner_select" ON calendar_events FOR SELECT
  USING (creator_id = auth.uid());

CREATE POLICY "events_invitee_select" ON calendar_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM calendar_event_invites
      WHERE event_id = id AND invitee_id = auth.uid()
    )
  );

CREATE POLICY "events_owner_insert" ON calendar_events FOR INSERT
  WITH CHECK (creator_id = auth.uid());

CREATE POLICY "events_owner_update" ON calendar_events FOR UPDATE
  USING (creator_id = auth.uid());

CREATE POLICY "events_owner_delete" ON calendar_events FOR DELETE
  USING (creator_id = auth.uid());

-- ── Calendar event invites ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS calendar_event_invites (
  event_id    UUID NOT NULL REFERENCES calendar_events(id) ON DELETE CASCADE,
  invitee_id  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status      TEXT NOT NULL DEFAULT 'pending'
              CHECK (status IN ('pending','accepted','declined')),
  PRIMARY KEY (event_id, invitee_id)
);

ALTER TABLE calendar_event_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "invites_select" ON calendar_event_invites FOR SELECT
  USING (
    invitee_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM calendar_events
      WHERE id = event_id AND creator_id = auth.uid()
    )
  );

CREATE POLICY "invites_creator_insert" ON calendar_event_invites FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM calendar_events
      WHERE id = event_id AND creator_id = auth.uid()
    )
  );

CREATE POLICY "invites_creator_delete" ON calendar_event_invites FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM calendar_events
      WHERE id = event_id AND creator_id = auth.uid()
    )
  );

CREATE POLICY "invites_invitee_update" ON calendar_event_invites FOR UPDATE
  USING (invitee_id = auth.uid());

-- ── Tasks ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tasks (
  id         UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID    NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title      TEXT    NOT NULL,
  done       BOOLEAN NOT NULL DEFAULT false,
  date       DATE    NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tasks_owner_all" ON tasks
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
