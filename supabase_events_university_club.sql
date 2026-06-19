-- Add University and Club context to Events

BEGIN;

ALTER TABLE public.events
ADD COLUMN IF NOT EXISTS university_name TEXT NOT NULL DEFAULT 'Unknown University',
ADD COLUMN IF NOT EXISTS club_name TEXT;

-- Remove the default constraint after backfilling existing rows (if any)
ALTER TABLE public.events ALTER COLUMN university_name DROP DEFAULT;

COMMIT;
