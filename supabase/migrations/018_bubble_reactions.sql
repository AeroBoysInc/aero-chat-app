-- 018_bubble_reactions.sql
-- ── Reactions for bubble messages ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.bubble_reactions (
  message_id UUID NOT NULL REFERENCES public.bubble_messages(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  emoji      TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (message_id, user_id, emoji)
);

ALTER TABLE public.bubble_reactions ENABLE ROW LEVEL SECURITY;

-- Members of the bubble's server can see reactions
CREATE POLICY "breact_select" ON public.bubble_reactions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.bubble_messages bm
      JOIN public.bubbles b ON b.id = bm.bubble_id
      WHERE bm.id = message_id AND is_server_member(b.server_id)
    )
  );

-- Members can add their own reactions
CREATE POLICY "breact_insert" ON public.bubble_reactions FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.bubble_messages bm
      JOIN public.bubbles b ON b.id = bm.bubble_id
      WHERE bm.id = message_id AND is_server_member(b.server_id)
    )
  );

-- Users can remove their own reactions
CREATE POLICY "breact_delete" ON public.bubble_reactions FOR DELETE
  USING (user_id = auth.uid());

-- Realtime
ALTER TABLE public.bubble_reactions REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.bubble_reactions;
