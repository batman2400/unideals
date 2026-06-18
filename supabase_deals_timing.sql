-- Automated Deal Scheduling Columns
-- Adds start_time and end_time to deals for automatic activation and expiration

ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS start_time timestamptz DEFAULT now();
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS end_time timestamptz NULL;
