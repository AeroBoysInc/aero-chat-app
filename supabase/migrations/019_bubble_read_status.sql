-- 019_bubble_read_status.sql
-- ── Persistent per-user read position for each bubble ───────────────────────

CREATE TABLE IF NOT EXISTS public.bubble_read_status (
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  bubble_id  UUID NOT NULL REFERENCES public.bubbles(id) ON DELETE CASCADE,
  last_read_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, bubble_id)
);

ALTER TABLE public.bubble_read_status ENABLE ROW LEVEL SECURITY;

-- Users can read their own status rows
CREATE POLICY "brs_select" ON public.bubble_read_status FOR SELECT
  USING (user_id = auth.uid());

-- Users can insert their own status rows
CREATE POLICY "brs_insert" ON public.bubble_read_status FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Users can update their own status rows
CREATE POLICY "brs_update" ON public.bubble_read_status FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
