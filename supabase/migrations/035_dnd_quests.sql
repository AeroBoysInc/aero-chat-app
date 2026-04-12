-- 035_dnd_quests.sql — Quest Tracker tables for DnD toolkit

-- ── 1. Quests table ──
CREATE TABLE dnd_quests (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id         UUID NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
  title             TEXT NOT NULL,
  description       TEXT NOT NULL DEFAULT '',
  is_secret         BOOLEAN NOT NULL DEFAULT false,
  secret_player_ids UUID[] NOT NULL DEFAULT '{}',
  is_completed      BOOLEAN NOT NULL DEFAULT false,
  completed_at      TIMESTAMPTZ,
  created_by        UUID NOT NULL REFERENCES profiles(id),
  sort_order        INTEGER NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_dnd_quests_server ON dnd_quests (server_id);
CREATE INDEX idx_dnd_quests_server_order ON dnd_quests (server_id, sort_order);

ALTER TABLE dnd_quests ENABLE ROW LEVEL SECURITY;

-- Select: public quests visible to all members; secret quests only to DMs or assigned players
CREATE POLICY "quests_select" ON dnd_quests
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM server_members sm
      WHERE sm.server_id = dnd_quests.server_id
        AND sm.user_id = auth.uid()
    )
    AND (
      dnd_quests.is_secret = false
      OR auth.uid() = ANY (dnd_quests.secret_player_ids)
      OR EXISTS (
        SELECT 1 FROM server_members sm
        JOIN server_role_permissions srp ON srp.role_id = sm.role_id
        WHERE sm.server_id = dnd_quests.server_id
          AND sm.user_id = auth.uid()
          AND srp.dungeon_master = true
      )
    )
  );

-- DMs can insert quests
CREATE POLICY "quests_insert" ON dnd_quests
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM server_members sm
      JOIN server_role_permissions srp ON srp.role_id = sm.role_id
      WHERE sm.server_id = dnd_quests.server_id
        AND sm.user_id = auth.uid()
        AND srp.dungeon_master = true
    )
  );

-- DMs can update any; assigned players can update completion of their secret quests
CREATE POLICY "quests_update" ON dnd_quests
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM server_members sm
      JOIN server_role_permissions srp ON srp.role_id = sm.role_id
      WHERE sm.server_id = dnd_quests.server_id
        AND sm.user_id = auth.uid()
        AND srp.dungeon_master = true
    )
    OR (
      dnd_quests.is_secret = true
      AND auth.uid() = ANY (dnd_quests.secret_player_ids)
    )
  );

-- DMs can delete quests
CREATE POLICY "quests_delete" ON dnd_quests
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM server_members sm
      JOIN server_role_permissions srp ON srp.role_id = sm.role_id
      WHERE sm.server_id = dnd_quests.server_id
        AND sm.user_id = auth.uid()
        AND srp.dungeon_master = true
    )
  );

-- ── 2. Enable realtime ──
ALTER TABLE dnd_quests REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE dnd_quests;
