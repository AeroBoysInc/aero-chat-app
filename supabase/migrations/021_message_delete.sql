-- 021_message_delete.sql
-- Allow users to delete their own messages in both DMs and server bubbles.

-- ── DM messages: sender can delete their own ─────────────────────────────────
CREATE POLICY "messages_sender_delete" ON public.messages FOR DELETE
  USING (sender_id = auth.uid());

-- ── Bubble messages: sender can delete their own ─────────────────────────────
CREATE POLICY "bmsg_sender_delete" ON public.bubble_messages FOR DELETE
  USING (sender_id = auth.uid());
