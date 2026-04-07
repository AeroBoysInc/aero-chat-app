-- 026_ultra_themes.sql
-- Add ultra theme ownership columns to profiles
ALTER TABLE profiles ADD COLUMN owns_john_frutiger BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE profiles ADD COLUMN owns_golden_hour BOOLEAN NOT NULL DEFAULT false;
