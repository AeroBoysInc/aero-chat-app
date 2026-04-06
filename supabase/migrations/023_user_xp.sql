-- 023_user_xp.sql
-- XP tracking table for Avatar Corner progression system.

CREATE TABLE IF NOT EXISTS public.user_xp (
  user_id    UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  chatter_xp BIGINT NOT NULL DEFAULT 0,
  gamer_xp   BIGINT NOT NULL DEFAULT 0,
  writer_xp  BIGINT NOT NULL DEFAULT 0,
  -- Daily cap tracking (reset when daily_date != today)
  chatter_daily INT NOT NULL DEFAULT 0,
  gamer_daily   INT NOT NULL DEFAULT 0,
  writer_daily  INT NOT NULL DEFAULT 0,
  daily_date    DATE NOT NULL DEFAULT CURRENT_DATE,
  -- Anti-abuse: hash of last message to prevent duplicate XP
  last_message_hash TEXT DEFAULT '',
  -- Streak tracking
  streak_days INT NOT NULL DEFAULT 0,
  streak_date DATE,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS: users can only read/write their own row
ALTER TABLE public.user_xp ENABLE ROW LEVEL SECURITY;

CREATE POLICY "xp_select_own" ON public.user_xp
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "xp_insert_own" ON public.user_xp
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "xp_update_own" ON public.user_xp
  FOR UPDATE USING (user_id = auth.uid());
