-- 036_dnd_dm_notes.sql — DM Notebook table for DnD toolkit

CREATE TABLE dnd_dm_notes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id  UUID NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
  title      TEXT NOT NULL DEFAULT 'Untitled',
  content    TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_dnd_dm_notes_server ON dnd_dm_notes (server_id);
CREATE INDEX idx_dnd_dm_notes_server_order ON dnd_dm_notes (server_id, sort_order);

ALTER TABLE dnd_dm_notes ENABLE ROW LEVEL SECURITY;

-- Only DMs can read DM notes
CREATE POLICY "dm_notes_select" ON dnd_dm_notes
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM server_members sm
      JOIN server_role_permissions srp ON srp.role_id = sm.role_id
      WHERE sm.server_id = dnd_dm_notes.server_id
        AND sm.user_id = auth.uid()
        AND srp.dungeon_master = true
    )
  );

-- DMs can insert notes
CREATE POLICY "dm_notes_insert" ON dnd_dm_notes
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM server_members sm
      JOIN server_role_permissions srp ON srp.role_id = sm.role_id
      WHERE sm.server_id = dnd_dm_notes.server_id
        AND sm.user_id = auth.uid()
        AND srp.dungeon_master = true
    )
  );

-- DMs can update notes
CREATE POLICY "dm_notes_update" ON dnd_dm_notes
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM server_members sm
      JOIN server_role_permissions srp ON srp.role_id = sm.role_id
      WHERE sm.server_id = dnd_dm_notes.server_id
        AND sm.user_id = auth.uid()
        AND srp.dungeon_master = true
    )
  );

-- DMs can delete notes
CREATE POLICY "dm_notes_delete" ON dnd_dm_notes
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM server_members sm
      JOIN server_role_permissions srp ON srp.role_id = sm.role_id
      WHERE sm.server_id = dnd_dm_notes.server_id
        AND sm.user_id = auth.uid()
        AND srp.dungeon_master = true
    )
  );
