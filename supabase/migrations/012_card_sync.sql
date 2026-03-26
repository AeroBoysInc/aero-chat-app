-- Migration 012: card sync columns + storage bucket

-- Add card customization columns to profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS card_gradient    TEXT    DEFAULT 'ocean',
  ADD COLUMN IF NOT EXISTS card_image_url   TEXT,
  ADD COLUMN IF NOT EXISTS card_image_params JSONB;

-- Create card-images storage bucket (public read)
INSERT INTO storage.buckets (id, name, public)
VALUES ('card-images', 'card-images', true)
ON CONFLICT DO NOTHING;

-- RLS: owner can INSERT their own files
-- Note: auth.uid() alone is sufficient — it is NULL for anonymous requests.
-- Do NOT use auth.role() = 'authenticated' here; it can fail unexpectedly in the storage context.
CREATE POLICY "card_images_insert" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'card-images'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- RLS: owner can UPDATE (overwrite) their own files
CREATE POLICY "card_images_update" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'card-images'
    AND auth.uid()::text = (storage.foldername(name))[1]
  ) WITH CHECK (
    bucket_id = 'card-images'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- RLS: owner can DELETE their own files
CREATE POLICY "card_images_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'card-images'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
