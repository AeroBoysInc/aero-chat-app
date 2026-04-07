-- 027_master_theme.sql
-- Add master theme ownership column to profiles
ALTER TABLE profiles ADD COLUMN owns_master BOOLEAN NOT NULL DEFAULT false;
