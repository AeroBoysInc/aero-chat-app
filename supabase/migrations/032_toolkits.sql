-- 032_toolkits.sql — Server toolkit activation + DM permission

-- ── 1. Toolkit activation table ──
CREATE TABLE server_toolkits (
  server_id    UUID PRIMARY KEY REFERENCES servers(id) ON DELETE CASCADE,
  toolkit_id   TEXT NOT NULL DEFAULT 'dnd',
  activated_by UUID NOT NULL REFERENCES profiles(id),
  activated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE server_toolkits ENABLE ROW LEVEL SECURITY;

-- Members of the server can read toolkit state
CREATE POLICY "toolkit_select" ON server_toolkits
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM server_members
      WHERE server_members.server_id = server_toolkits.server_id
        AND server_members.user_id = auth.uid()
    )
  );

-- Only the server owner can activate a toolkit
CREATE POLICY "toolkit_insert" ON server_toolkits
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM servers
      WHERE servers.id = server_toolkits.server_id
        AND servers.owner_id = auth.uid()
    )
  );

-- Only the server owner can deactivate a toolkit
CREATE POLICY "toolkit_delete" ON server_toolkits
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM servers
      WHERE servers.id = server_toolkits.server_id
        AND servers.owner_id = auth.uid()
    )
  );

-- ── 2. Add dungeon_master permission to server roles ──
ALTER TABLE server_role_permissions
  ADD COLUMN dungeon_master BOOLEAN NOT NULL DEFAULT false;
