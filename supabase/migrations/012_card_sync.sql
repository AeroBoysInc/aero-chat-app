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

-- RLS: use TO authenticated role — required for newer Supabase projects.
-- Do NOT use auth.role() = 'authenticated'; use the TO clause instead.
CREATE POLICY "card_images_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'card-images'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "card_images_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'card-images'
    AND auth.uid()::text = (storage.foldername(name))[1]
  )
  WITH CHECK (
    bucket_id = 'card-images'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "card_images_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'card-images'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
