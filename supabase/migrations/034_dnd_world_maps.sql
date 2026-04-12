-- 034_dnd_world_maps.sql — World Map tables for DnD toolkit

-- ── 1. Maps table ──
CREATE TABLE dnd_maps (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id   UUID NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  image_url   TEXT NOT NULL,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_by  UUID NOT NULL REFERENCES profiles(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_dnd_maps_server ON dnd_maps (server_id);
CREATE INDEX idx_dnd_maps_server_order ON dnd_maps (server_id, sort_order);

ALTER TABLE dnd_maps ENABLE ROW LEVEL SECURITY;

-- Server members can read all maps (visibility is client-side)
CREATE POLICY "maps_select" ON dnd_maps
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM server_members
      WHERE server_members.server_id = dnd_maps.server_id
        AND server_members.user_id = auth.uid()
    )
  );

-- DMs can insert maps
CREATE POLICY "maps_insert" ON dnd_maps
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM server_members sm
      JOIN server_role_permissions srp ON srp.role_id = sm.role_id
      WHERE sm.server_id = dnd_maps.server_id
        AND sm.user_id = auth.uid()
        AND srp.dungeon_master = true
    )
  );

-- DMs can update maps
CREATE POLICY "maps_update" ON dnd_maps
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM server_members sm
      JOIN server_role_permissions srp ON srp.role_id = sm.role_id
      WHERE sm.server_id = dnd_maps.server_id
        AND sm.user_id = auth.uid()
        AND srp.dungeon_master = true
    )
  );

-- DMs can delete maps
CREATE POLICY "maps_delete" ON dnd_maps
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM server_members sm
      JOIN server_role_permissions srp ON srp.role_id = sm.role_id
      WHERE sm.server_id = dnd_maps.server_id
        AND sm.user_id = auth.uid()
        AND srp.dungeon_master = true
    )
  );

-- ── 2. Pins table ──
CREATE TABLE dnd_map_pins (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  map_id           UUID NOT NULL REFERENCES dnd_maps(id) ON DELETE CASCADE,
  x                DOUBLE PRECISION NOT NULL,
  y                DOUBLE PRECISION NOT NULL,
  pin_type         TEXT NOT NULL DEFAULT 'custom',
  emoji            TEXT NOT NULL DEFAULT '📍',
  name             TEXT NOT NULL,
  subtitle         TEXT NOT NULL DEFAULT '',
  description      JSONB NOT NULL DEFAULT '{}',
  header_image_url TEXT,
  color            TEXT NOT NULL DEFAULT '#00b4ff',
  created_by       UUID NOT NULL REFERENCES profiles(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_dnd_map_pins_map ON dnd_map_pins (map_id);

ALTER TABLE dnd_map_pins ENABLE ROW LEVEL SECURITY;

-- Server members can read all pins (visibility is at the map level, client-side)
CREATE POLICY "pins_select" ON dnd_map_pins
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM dnd_maps m
      JOIN server_members sm ON sm.server_id = m.server_id
      WHERE m.id = dnd_map_pins.map_id
        AND sm.user_id = auth.uid()
    )
  );

-- DMs can insert pins
CREATE POLICY "pins_insert" ON dnd_map_pins
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM dnd_maps m
      JOIN server_members sm ON sm.server_id = m.server_id
      JOIN server_role_permissions srp ON srp.role_id = sm.role_id
      WHERE m.id = dnd_map_pins.map_id
        AND sm.user_id = auth.uid()
        AND srp.dungeon_master = true
    )
  );

-- DMs can update pins
CREATE POLICY "pins_update" ON dnd_map_pins
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM dnd_maps m
      JOIN server_members sm ON sm.server_id = m.server_id
      JOIN server_role_permissions srp ON srp.role_id = sm.role_id
      WHERE m.id = dnd_map_pins.map_id
        AND sm.user_id = auth.uid()
        AND srp.dungeon_master = true
    )
  );

-- DMs can delete pins
CREATE POLICY "pins_delete" ON dnd_map_pins
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM dnd_maps m
      JOIN server_members sm ON sm.server_id = m.server_id
      JOIN server_role_permissions srp ON srp.role_id = sm.role_id
      WHERE m.id = dnd_map_pins.map_id
        AND sm.user_id = auth.uid()
        AND srp.dungeon_master = true
    )
  );

-- ── 3. Map visibility table ──
CREATE TABLE dnd_map_visibility (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  map_id      UUID NOT NULL REFERENCES dnd_maps(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL,
  target_id   UUID NOT NULL,
  UNIQUE (map_id, target_type, target_id)
);

ALTER TABLE dnd_map_visibility ENABLE ROW LEVEL SECURITY;

-- Server members can read visibility rows (needed for client-side filtering)
CREATE POLICY "vis_select" ON dnd_map_visibility
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM dnd_maps m
      JOIN server_members sm ON sm.server_id = m.server_id
      WHERE m.id = dnd_map_visibility.map_id
        AND sm.user_id = auth.uid()
    )
  );

-- DMs can manage visibility
CREATE POLICY "vis_insert" ON dnd_map_visibility
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM dnd_maps m
      JOIN server_members sm ON sm.server_id = m.server_id
      JOIN server_role_permissions srp ON srp.role_id = sm.role_id
      WHERE m.id = dnd_map_visibility.map_id
        AND sm.user_id = auth.uid()
        AND srp.dungeon_master = true
    )
  );

CREATE POLICY "vis_delete" ON dnd_map_visibility
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM dnd_maps m
      JOIN server_members sm ON sm.server_id = m.server_id
      JOIN server_role_permissions srp ON srp.role_id = sm.role_id
      WHERE m.id = dnd_map_visibility.map_id
        AND sm.user_id = auth.uid()
        AND srp.dungeon_master = true
    )
  );

-- ── 4. Enable realtime ──
ALTER TABLE dnd_maps REPLICA IDENTITY FULL;
ALTER TABLE dnd_map_pins REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE dnd_maps;
ALTER PUBLICATION supabase_realtime ADD TABLE dnd_map_pins;
