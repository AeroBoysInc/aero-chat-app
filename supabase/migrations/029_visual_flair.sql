-- Migration 029: Visual Flair columns
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_gif_url text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS name_effect text;
