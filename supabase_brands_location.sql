-- Add location column to the brands table
ALTER TABLE public.brands ADD COLUMN IF NOT EXISTS location TEXT;
