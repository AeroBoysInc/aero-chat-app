-- 033_dnd_characters.sql — DnD character cards + asset storage

-- ── 1. Characters table ──
CREATE TABLE dnd_characters (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id         UUID NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
  user_id           UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name              TEXT NOT NULL,
  species           TEXT NOT NULL DEFAULT '',
  class             TEXT NOT NULL DEFAULT '',
  level             INTEGER NOT NULL DEFAULT 1,
  portrait_url      TEXT,
  background_url    TEXT,
  hp_current        INTEGER NOT NULL DEFAULT 0,
  hp_max            INTEGER NOT NULL DEFAULT 0,
  xp_current        INTEGER NOT NULL DEFAULT 0,
  xp_max            INTEGER NOT NULL DEFAULT 0,
  gold              INTEGER NOT NULL DEFAULT 0,
  stats             JSONB NOT NULL DEFAULT '{"str":10,"dex":10,"con":10,"int":10,"wis":10,"cha":10}',
  armor_class       INTEGER NOT NULL DEFAULT 10,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (server_id, user_id)
);

ALTER TABLE dnd_characters ENABLE ROW LEVEL SECURITY;

-- Server members can read all characters in their server
CREATE POLICY "char_select" ON dnd_characters
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM server_members
      WHERE server_members.server_id = dnd_characters.server_id
        AND server_members.user_id = auth.uid()
    )
  );

-- Users can insert their own character
CREATE POLICY "char_insert" ON dnd_characters
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM server_members
      WHERE server_members.server_id = dnd_characters.server_id
        AND server_members.user_id = auth.uid()
    )
  );

-- Users can update their own character
CREATE POLICY "char_update_own" ON dnd_characters
  FOR UPDATE USING (auth.uid() = user_id);

-- DMs can update any character (for HP adjustments during sessions)
CREATE POLICY "char_update_dm" ON dnd_characters
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM server_members sm
      JOIN server_role_permissions srp ON srp.role_id = sm.role_id
      WHERE sm.server_id = dnd_characters.server_id
        AND sm.user_id = auth.uid()
        AND srp.dungeon_master = true
    )
  );

-- Users can delete their own character
CREATE POLICY "char_delete" ON dnd_characters
  FOR DELETE USING (auth.uid() = user_id);

-- ── 2. Enable realtime for live HP/XP updates ──
ALTER TABLE dnd_characters REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE dnd_characters;

-- ── 3. Storage bucket for character portraits, backgrounds, and map images ──
INSERT INTO storage.buckets (id, name, public) VALUES ('dnd-assets', 'dnd-assets', true);

CREATE POLICY "dnd_assets_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'dnd-assets');

CREATE POLICY "dnd_assets_upload" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'dnd-assets' AND auth.role() = 'authenticated');

CREATE POLICY "dnd_assets_delete" ON storage.objects
  FOR DELETE USING (bucket_id = 'dnd-assets' AND auth.uid() = owner);
