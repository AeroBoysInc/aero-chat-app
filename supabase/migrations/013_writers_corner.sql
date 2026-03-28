-- ============================================================
-- 013_writers_corner.sql — Writers Corner schema
-- ============================================================

-- ── Writer roles ──────────────────────────────────────────────
CREATE TABLE public.writer_roles (
  user_id    UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  role       TEXT NOT NULL DEFAULT 'reader'
               CHECK (role IN ('dev', 'writer', 'reader')),
  applied_at  TIMESTAMPTZ,
  approved_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.writer_roles ENABLE ROW LEVEL SECURITY;

-- Everyone can read their own role
CREATE POLICY "wr_select_own" ON public.writer_roles FOR SELECT
  USING (auth.uid() = user_id);

-- DejanAdmin can read all roles (for admin panel)
CREATE POLICY "wr_select_admin" ON public.writer_roles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND username = 'DejanAdmin'
    )
  );

-- Users can insert their own role (self-registration as reader)
CREATE POLICY "wr_insert_own" ON public.writer_roles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own row (to set applied_at when applying)
CREATE POLICY "wr_update_own" ON public.writer_roles FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND role = 'reader'
  );

-- DejanAdmin can update any role (approve/reject writers)
CREATE POLICY "wr_update_admin" ON public.writer_roles FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND username = 'DejanAdmin'
    )
  );

-- ── Stories ──────────────────────────────────────────────────
CREATE TABLE public.stories (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  content         TEXT NOT NULL DEFAULT '',
  category        TEXT NOT NULL DEFAULT 'other'
                    CHECK (category IN (
                      'fantasy', 'horror', 'scifi', 'romance',
                      'mystery', 'comedy', 'drama', 'adventure', 'other'
                    )),
  visibility      TEXT NOT NULL DEFAULT 'private'
                    CHECK (visibility IN ('private', 'friends', 'public')),
  cover_image_url TEXT,
  views           INT NOT NULL DEFAULT 0,
  likes_count     INT NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.stories ENABLE ROW LEVEL SECURITY;

-- Authors can see all their own stories
CREATE POLICY "stories_select_own" ON public.stories FOR SELECT
  USING (auth.uid() = author_id);

-- Anyone can see public stories
CREATE POLICY "stories_select_public" ON public.stories FOR SELECT
  USING (visibility = 'public');

-- Friends can see friends-only stories
CREATE POLICY "stories_select_friends" ON public.stories FOR SELECT
  USING (
    visibility = 'friends'
    AND EXISTS (
      SELECT 1 FROM public.friend_requests fr
      WHERE fr.status = 'accepted'
        AND (
          (fr.sender_id = auth.uid() AND fr.receiver_id = author_id)
          OR (fr.receiver_id = auth.uid() AND fr.sender_id = author_id)
        )
    )
  );

-- Only writers and devs can insert stories
CREATE POLICY "stories_insert" ON public.stories FOR INSERT
  WITH CHECK (
    auth.uid() = author_id
    AND EXISTS (
      SELECT 1 FROM public.writer_roles
      WHERE user_id = auth.uid() AND role IN ('writer', 'dev')
    )
  );

-- Authors can update their own stories
CREATE POLICY "stories_update" ON public.stories FOR UPDATE
  USING (auth.uid() = author_id);

-- Authors can delete their own stories
CREATE POLICY "stories_delete" ON public.stories FOR DELETE
  USING (auth.uid() = author_id);

-- ── Story likes ──────────────────────────────────────────────
CREATE TABLE public.story_likes (
  story_id   UUID NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (story_id, user_id)
);

ALTER TABLE public.story_likes ENABLE ROW LEVEL SECURITY;

-- Users can see their own likes
CREATE POLICY "likes_select_own" ON public.story_likes FOR SELECT
  USING (auth.uid() = user_id);

-- Users can see like counts (needed for public stories)
CREATE POLICY "likes_select_public" ON public.story_likes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.stories s
      WHERE s.id = story_id AND s.visibility = 'public'
    )
  );

-- Authenticated users can like stories they can see
CREATE POLICY "likes_insert" ON public.story_likes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can unlike (delete their own like)
CREATE POLICY "likes_delete" ON public.story_likes FOR DELETE
  USING (auth.uid() = user_id);

-- ── Updated-at trigger (reuse existing function from 011) ────
CREATE TRIGGER stories_updated_at
  BEFORE UPDATE ON public.stories
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- ── Increment views via RPC ──────────────────────────────────
CREATE OR REPLACE FUNCTION public.increment_story_views(story_uuid UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE public.stories SET views = views + 1 WHERE id = story_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── Realtime ─────────────────────────────────────────────────
ALTER PUBLICATION supabase_realtime ADD TABLE public.stories;
ALTER PUBLICATION supabase_realtime ADD TABLE public.writer_roles;

-- ── Storage bucket for cover images ──────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'story-covers',
  'story-covers',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
);

CREATE POLICY "story_covers_insert" ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'story-covers'
    AND auth.role() = 'authenticated'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "story_covers_select" ON storage.objects FOR SELECT
  USING (bucket_id = 'story-covers');

CREATE POLICY "story_covers_update" ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'story-covers'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "story_covers_delete" ON storage.objects FOR DELETE
  USING (
    bucket_id = 'story-covers'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
