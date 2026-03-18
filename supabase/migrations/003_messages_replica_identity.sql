-- Run this in your Supabase SQL editor after 002_friends_and_avatars.sql

-- Enable REPLICA IDENTITY FULL on messages so Supabase Realtime can evaluate
-- RLS policies on INSERT events and deliver them reliably to subscribers.
alter table public.messages replica identity full;
