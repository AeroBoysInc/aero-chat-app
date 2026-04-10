-- 031_group_chats.sql — Group chats: tables, RLS, indexes, storage

-- ═══════════════════════════════════════════════════════════════════
-- 1. CREATE ALL TABLES FIRST (policies reference each other)
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS group_chats (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name                text NOT NULL,
  leader_id           uuid NOT NULL REFERENCES profiles(id),
  group_key_encrypted jsonb DEFAULT '{}'::jsonb,
  card_gradient       text,
  card_image_url      text,
  card_image_params   jsonb,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS group_members (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id   uuid NOT NULL REFERENCES group_chats(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES profiles(id),
  joined_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (group_id, user_id)
);

CREATE TABLE IF NOT EXISTS group_invites (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id    uuid NOT NULL REFERENCES group_chats(id) ON DELETE CASCADE,
  inviter_id  uuid NOT NULL REFERENCES profiles(id),
  invitee_id  uuid NOT NULL REFERENCES profiles(id),
  status      text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (group_id, invitee_id)
);

CREATE TABLE IF NOT EXISTS group_messages (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id    uuid NOT NULL REFERENCES group_chats(id) ON DELETE CASCADE,
  sender_id   uuid NOT NULL REFERENCES profiles(id),
  content     text NOT NULL,
  nonce       text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_group_messages_group_created
  ON group_messages (group_id, created_at);

-- ═══════════════════════════════════════════════════════════════════
-- 2. ENABLE RLS ON ALL TABLES
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE group_chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_messages ENABLE ROW LEVEL SECURITY;

-- ═══════════════════════════════════════════════════════════════════
-- 3. RLS POLICIES — group_chats
-- ═══════════════════════════════════════════════════════════════════

-- SELECT: user is a member
CREATE POLICY "group_chats_select" ON group_chats FOR SELECT USING (
  EXISTS (SELECT 1 FROM group_members gm WHERE gm.group_id = id AND gm.user_id = auth.uid())
);

-- INSERT: any authenticated user
CREATE POLICY "group_chats_insert" ON group_chats FOR INSERT WITH CHECK (
  auth.uid() IS NOT NULL
);

-- UPDATE: only leader
CREATE POLICY "group_chats_update" ON group_chats FOR UPDATE USING (
  leader_id = auth.uid()
);

-- DELETE: only leader
CREATE POLICY "group_chats_delete" ON group_chats FOR DELETE USING (
  leader_id = auth.uid()
);

-- ═══════════════════════════════════════════════════════════════════
-- 4. RLS POLICIES — group_members
-- ═══════════════════════════════════════════════════════════════════

-- SELECT: user must be member of the group
CREATE POLICY "group_members_select" ON group_members FOR SELECT USING (
  EXISTS (SELECT 1 FROM group_members gm2 WHERE gm2.group_id = group_id AND gm2.user_id = auth.uid())
);

-- INSERT: only group leader can add members
CREATE POLICY "group_members_insert" ON group_members FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM group_chats gc WHERE gc.id = group_id AND gc.leader_id = auth.uid())
);

-- DELETE: user can remove self, leader can remove anyone
CREATE POLICY "group_members_delete" ON group_members FOR DELETE USING (
  user_id = auth.uid()
  OR EXISTS (SELECT 1 FROM group_chats gc WHERE gc.id = group_id AND gc.leader_id = auth.uid())
);

-- ═══════════════════════════════════════════════════════════════════
-- 5. RLS POLICIES — group_invites
-- ═══════════════════════════════════════════════════════════════════

-- SELECT: inviter or invitee
CREATE POLICY "group_invites_select" ON group_invites FOR SELECT USING (
  inviter_id = auth.uid() OR invitee_id = auth.uid()
);

-- INSERT: only group leader
CREATE POLICY "group_invites_insert" ON group_invites FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM group_chats gc WHERE gc.id = group_id AND gc.leader_id = auth.uid())
);

-- UPDATE: only invitee can change status
CREATE POLICY "group_invites_update" ON group_invites FOR UPDATE USING (
  invitee_id = auth.uid()
);

-- ═══════════════════════════════════════════════════════════════════
-- 6. RLS POLICIES — group_messages
-- ═══════════════════════════════════════════════════════════════════

-- SELECT: user must be member
CREATE POLICY "group_messages_select" ON group_messages FOR SELECT USING (
  EXISTS (SELECT 1 FROM group_members gm WHERE gm.group_id = group_id AND gm.user_id = auth.uid())
);

-- INSERT: user must be member and sender_id matches
CREATE POLICY "group_messages_insert" ON group_messages FOR INSERT WITH CHECK (
  sender_id = auth.uid()
  AND EXISTS (SELECT 1 FROM group_members gm WHERE gm.group_id = group_id AND gm.user_id = auth.uid())
);

-- ═══════════════════════════════════════════════════════════════════
-- 7. Realtime — enable postgres_changes for new tables
-- ═══════════════════════════════════════════════════════════════════
ALTER PUBLICATION supabase_realtime ADD TABLE group_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE group_members;
ALTER PUBLICATION supabase_realtime ADD TABLE group_invites;

-- ═══════════════════════════════════════════════════════════════════
-- 8. Storage — group-images bucket
-- ═══════════════════════════════════════════════════════════════════
INSERT INTO storage.buckets (id, name, public) VALUES ('group-images', 'group-images', true)
ON CONFLICT (id) DO NOTHING;

-- RLS on storage: only group leader can upload/update/delete
CREATE POLICY "group_images_insert" ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'group-images'
  AND EXISTS (
    SELECT 1 FROM group_chats gc
    WHERE gc.id = (storage.foldername(name))[1]::uuid
    AND gc.leader_id = auth.uid()
  )
);

CREATE POLICY "group_images_update" ON storage.objects FOR UPDATE USING (
  bucket_id = 'group-images'
  AND EXISTS (
    SELECT 1 FROM group_chats gc
    WHERE gc.id = (storage.foldername(name))[1]::uuid
    AND gc.leader_id = auth.uid()
  )
);

CREATE POLICY "group_images_delete" ON storage.objects FOR DELETE USING (
  bucket_id = 'group-images'
  AND EXISTS (
    SELECT 1 FROM group_chats gc
    WHERE gc.id = (storage.foldername(name))[1]::uuid
    AND gc.leader_id = auth.uid()
  )
);

-- Public read for group images
CREATE POLICY "group_images_select" ON storage.objects FOR SELECT USING (
  bucket_id = 'group-images'
);
