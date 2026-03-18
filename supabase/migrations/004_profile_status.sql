-- Add status column to profiles and enable full replica identity for realtime

alter table public.profiles
  add column if not exists status text not null default 'online'
    check (status in ('online', 'busy', 'away', 'offline'));

-- Required for postgres_changes UPDATE events on profiles to work reliably
alter table public.profiles replica identity full;

-- Add profiles to the realtime publication so status changes are broadcast live
alter publication supabase_realtime add table public.profiles;
