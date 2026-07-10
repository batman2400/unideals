-- Add missing university and club columns to events table
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS university_name TEXT;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS club_name TEXT;
