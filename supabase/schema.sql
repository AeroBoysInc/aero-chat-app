-- Run this in your Supabase SQL editor

-- Profiles table (extends auth.users)
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  username    text not null unique,
  public_key  text not null,
  created_at  timestamptz default now()
);

-- Messages table
create table public.messages (
  id            uuid primary key default gen_random_uuid(),
  sender_id     uuid not null references public.profiles(id) on delete cascade,
  recipient_id  uuid not null references public.profiles(id) on delete cascade,
  content       text not null,  -- encrypted ciphertext only
  created_at    timestamptz default now()
);

create index on public.messages (sender_id, recipient_id, created_at);

-- Row Level Security
alter table public.profiles enable row level security;
alter table public.messages  enable row level security;

-- Profiles: anyone can read, only owner can insert/update
create policy "profiles_select" on public.profiles for select using (true);
create policy "profiles_insert" on public.profiles for insert with check (auth.uid() = id);
create policy "profiles_update" on public.profiles for update using (auth.uid() = id);

-- Messages: only sender and recipient can read; only sender can insert
create policy "messages_select" on public.messages for select
  using (auth.uid() = sender_id or auth.uid() = recipient_id);
create policy "messages_insert" on public.messages for insert
  with check (auth.uid() = sender_id);

-- Enable real-time for messages
alter publication supabase_realtime add table public.messages;
