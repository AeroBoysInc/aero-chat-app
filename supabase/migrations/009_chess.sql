-- Migration 009: AeroChess — chess_games + chess_queue tables

CREATE TABLE public.chess_games (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  blue_player_id   UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  green_player_id  UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  fen              TEXT        NOT NULL DEFAULT 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
  status           TEXT        NOT NULL DEFAULT 'pending'
                               CHECK (status IN ('pending','active','blue_wins','green_wins','draw','abandoned')),
  last_move        JSONB,
  blue_last_seen   TIMESTAMPTZ DEFAULT now(),
  green_last_seen  TIMESTAMPTZ DEFAULT now(),
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.chess_queue (
  id          UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID  REFERENCES public.profiles(id) ON DELETE CASCADE,
  status      TEXT  NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting','matched')),
  game_id     UUID  REFERENCES public.chess_games(id),
  created_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id)
);

-- RLS
ALTER TABLE public.chess_games ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chess_queue ENABLE ROW LEVEL SECURITY;

-- chess_games: players can read/insert/update games they belong to
CREATE POLICY "chess_games_select" ON public.chess_games FOR SELECT
  USING (auth.uid() = blue_player_id OR auth.uid() = green_player_id);

CREATE POLICY "chess_games_insert" ON public.chess_games FOR INSERT
  WITH CHECK (auth.uid() = blue_player_id OR auth.uid() = green_player_id);

CREATE POLICY "chess_games_update" ON public.chess_games FOR UPDATE
  USING (auth.uid() = blue_player_id OR auth.uid() = green_player_id);

-- chess_queue: authenticated users can read all waiting entries (needed for matchmaking);
-- users can only write their own entry
CREATE POLICY "chess_queue_select" ON public.chess_queue FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "chess_queue_insert" ON public.chess_queue FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "chess_queue_update" ON public.chess_queue FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "chess_queue_delete" ON public.chess_queue FOR DELETE
  USING (auth.uid() = user_id);
