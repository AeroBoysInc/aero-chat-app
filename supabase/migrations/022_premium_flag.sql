-- 022_premium_flag.sql
-- Add is_premium boolean to profiles for freemium gating.

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_premium BOOLEAN NOT NULL DEFAULT false;

-- Grant premium to DejanAdmin
UPDATE public.profiles SET is_premium = true WHERE username = 'DejanAdmin';
