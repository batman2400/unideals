-- Add missing columns for V1 Walled Garden Event Architecture
ALTER TABLE public.events
ADD COLUMN IF NOT EXISTS target_audience TEXT DEFAULT 'all_students',
ADD COLUMN IF NOT EXISTS external_registration_url TEXT;
