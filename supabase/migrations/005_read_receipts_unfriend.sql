-- ── Read receipts ────────────────────────────────────────────────────────────

alter table public.messages
  add column if not exists read_at timestamptz;

-- Recipient can mark messages read (set read_at timestamp)
create policy "messages_update" on public.messages for update
  using (auth.uid() = recipient_id)
  with check (auth.uid() = recipient_id);

-- ── Unfriend (allow either party to delete a friend_request row) ──────────────

create policy "fr_delete" on public.friend_requests for delete
  using (auth.uid() = sender_id or auth.uid() = receiver_id);
