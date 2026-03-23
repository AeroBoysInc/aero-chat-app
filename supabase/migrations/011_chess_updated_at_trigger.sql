-- Migration 011: Auto-update updated_at on chess_games row changes
-- Fixes: invite accept didn't bump updated_at, so inviter's polling never detected pending→active transition

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER chess_games_updated_at
  BEFORE UPDATE ON public.chess_games
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();
