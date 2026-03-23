-- Migration 010: Enable Realtime for chess tables
-- Run this in the Supabase SQL Editor after migration 009.

ALTER PUBLICATION supabase_realtime ADD TABLE public.chess_games;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chess_queue;
