-- ── 007: chat-files storage bucket ────────────────────────────────────────────

-- Create the bucket (public so img src URLs resolve without auth headers)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'chat-files',
  'chat-files',
  true,
  10485760, -- 10 MB
  ARRAY[
    'image/jpeg','image/png','image/gif','image/webp','image/svg+xml',
    'application/pdf','text/plain','text/csv',
    'application/zip','application/x-zip-compressed',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
) ON CONFLICT (id) DO NOTHING;

-- Only authenticated users can upload, and only into their own folder
CREATE POLICY "chat_files_insert" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'chat-files'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Any authenticated user can read (URL is only reachable via E2E-encrypted message)
CREATE POLICY "chat_files_select" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'chat-files'
    AND auth.role() = 'authenticated'
  );
