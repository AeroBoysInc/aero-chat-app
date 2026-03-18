-- Run this in your Supabase SQL editor after schema.sql

-- 1. Add avatar_url to profiles
alter table public.profiles
  add column if not exists avatar_url text;

-- 2. Friend requests table
create table if not exists public.friend_requests (
  id          uuid primary key default gen_random_uuid(),
  sender_id   uuid not null references public.profiles(id) on delete cascade,
  receiver_id uuid not null references public.profiles(id) on delete cascade,
  status      text not null default 'pending'
                   check (status in ('pending', 'accepted', 'declined')),
  created_at  timestamptz default now(),
  unique (sender_id, receiver_id)
);

alter table public.friend_requests enable row level security;

create policy "fr_select" on public.friend_requests for select
  using (auth.uid() = sender_id or auth.uid() = receiver_id);

create policy "fr_insert" on public.friend_requests for insert
  with check (auth.uid() = sender_id);

create policy "fr_update" on public.friend_requests for update
  using (auth.uid() = receiver_id);

alter publication supabase_realtime add table public.friend_requests;

-- 3. Gate messages behind accepted friendship
drop policy if exists "messages_insert" on public.messages;

create policy "messages_insert" on public.messages for insert
  with check (
    auth.uid() = sender_id
    and exists (
      select 1 from public.friend_requests
      where status = 'accepted'
        and (
          (sender_id = auth.uid() and receiver_id = messages.recipient_id)
          or
          (receiver_id = auth.uid() and sender_id = messages.recipient_id)
        )
    )
  );

-- 4. Storage bucket for avatars (run separately if this errors — Supabase Cloud uses the dashboard)
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict do nothing;

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
