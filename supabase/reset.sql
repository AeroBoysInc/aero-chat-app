-- ============================================================
-- AeroChat — full reset & recreate
-- Run this entire file in the Supabase SQL editor to start fresh.
-- WARNING: drops all existing data.
-- ============================================================

-- ── 1. Drop everything ──────────────────────────────────────

drop table if exists public.messages       cascade;
drop table if exists public.friend_requests cascade;
drop table if exists public.profiles        cascade;

-- ── 2. Profiles ─────────────────────────────────────────────

create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  username    text not null unique,
  public_key  text not null,
  avatar_url  text,
  status      text not null default 'online'
                   check (status in ('online', 'busy', 'away', 'offline')),
  created_at  timestamptz default now()
);

alter table public.profiles replica identity full;

alter table public.profiles enable row level security;

create policy "profiles_select" on public.profiles for select using (true);
create policy "profiles_insert" on public.profiles for insert with check (auth.uid() = id);
create policy "profiles_update" on public.profiles for update using (auth.uid() = id);

-- ── 3. Messages ─────────────────────────────────────────────

create table public.messages (
  id            uuid primary key default gen_random_uuid(),
  sender_id     uuid not null references public.profiles(id) on delete cascade,
  recipient_id  uuid not null references public.profiles(id) on delete cascade,
  content       text not null,
  read_at       timestamptz,
  created_at    timestamptz default now()
);

create index on public.messages (sender_id, recipient_id, created_at);

alter table public.messages enable row level security;
alter table public.messages replica identity full;

-- Only sender and recipient can read a message.
-- Any authenticated user can send to any other user (friend check is UI-only).
create policy "messages_select" on public.messages for select
  using (auth.uid() = sender_id or auth.uid() = recipient_id);

create policy "messages_insert" on public.messages for insert
  with check (auth.uid() = sender_id);

create policy "messages_update" on public.messages for update
  using (auth.uid() = recipient_id)
  with check (auth.uid() = recipient_id);

alter publication supabase_realtime add table public.profiles;
alter publication supabase_realtime add table public.messages;

-- ── 4. Friend requests ──────────────────────────────────────

create table public.friend_requests (
  id          uuid primary key default gen_random_uuid(),
  sender_id   uuid not null references public.profiles(id) on delete cascade,
  receiver_id uuid not null references public.profiles(id) on delete cascade,
  status      text not null default 'pending'
                   check (status in ('pending', 'accepted', 'declined')),
  created_at  timestamptz default now(),
  unique (sender_id, receiver_id)
);

alter table public.friend_requests enable row level security;
alter table public.friend_requests replica identity full;

create policy "fr_select" on public.friend_requests for select
  using (auth.uid() = sender_id or auth.uid() = receiver_id);

create policy "fr_insert" on public.friend_requests for insert
  with check (auth.uid() = sender_id);

create policy "fr_update" on public.friend_requests for update
  using (auth.uid() = receiver_id);

create policy "fr_delete" on public.friend_requests for delete
  using (auth.uid() = sender_id or auth.uid() = receiver_id);

alter publication supabase_realtime add table public.friend_requests;

-- ── 5. Avatar storage bucket ────────────────────────────────
-- If this block errors, create the bucket manually in the
-- Supabase dashboard (Storage → New bucket → "avatars", public).

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict do nothing;

drop policy if exists "avatars_select" on storage.objects;
drop policy if exists "avatars_insert" on storage.objects;
drop policy if exists "avatars_update" on storage.objects;

create policy "avatars_select" on storage.objects for select
  using (bucket_id = 'avatars');

create policy "avatars_insert" on storage.objects for insert
  with check (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "avatars_update" on storage.objects for update
  using (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
