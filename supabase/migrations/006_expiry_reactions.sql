-- ── 006: message expiry + emoji reactions ────────────────────────────────────

-- 1. Add expires_at to messages
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS expires_at timestamptz;

-- 2. Re-create SELECT policy to hide expired messages for both parties
DROP POLICY IF EXISTS messages_select ON public.messages;
CREATE POLICY messages_select ON public.messages
  FOR SELECT USING (
    auth.uid() IN (sender_id, recipient_id)
    AND (expires_at IS NULL OR expires_at > now())
  );

-- 3. Reactions table
CREATE TABLE IF NOT EXISTS public.reactions (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id  uuid        NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  user_id     uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  emoji       text        NOT NULL,
  created_at  timestamptz DEFAULT now(),
  UNIQUE (message_id, user_id, emoji)
);

ALTER TABLE public.reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reactions REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.reactions;

-- Only conversation participants can see reactions
CREATE POLICY reactions_select ON public.reactions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.messages m
      WHERE m.id = message_id
        AND auth.uid() IN (m.sender_id, m.recipient_id)
    )
  );

-- Users can only add their own reactions (must be a participant)
CREATE POLICY reactions_insert ON public.reactions
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.messages m
      WHERE m.id = message_id
        AND auth.uid() IN (m.sender_id, m.recipient_id)
    )
  );

-- Users can only remove their own reactions
CREATE POLICY reactions_delete ON public.reactions
  FOR DELETE USING (auth.uid() = user_id);
