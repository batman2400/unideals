-- Add business metadata to the brands table
ALTER TABLE public.brands ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE public.brands ADD COLUMN IF NOT EXISTS instagram_handle TEXT;
ALTER TABLE public.brands ADD COLUMN IF NOT EXISTS tiktok_handle TEXT;
