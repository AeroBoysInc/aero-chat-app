-- 028_identity_columns.sql
-- Add identity customization columns to profiles

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS bio text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS custom_status_text text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS custom_status_emoji text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS accent_color text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS accent_color_secondary text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS banner_gradient text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS banner_image_url text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS card_effect text;

-- Migrate existing card_gradient values to banner_gradient
UPDATE profiles SET banner_gradient = card_gradient WHERE card_gradient IS NOT NULL AND banner_gradient IS NULL;
