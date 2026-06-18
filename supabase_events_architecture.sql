-- V1 Walled Garden Event Architecture

-- Create the events table
CREATE TABLE IF NOT EXISTS public.events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  organizer_id UUID REFERENCES auth.users(id),
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ,
  location_name TEXT,
  category TEXT,
  cover_image_url TEXT,
  rsvp_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

-- Read Policy: Allow all authenticated users to SELECT (read) events
CREATE POLICY "Allow authenticated users to read events"
ON public.events
FOR SELECT
TO authenticated
USING (true);

-- Write Policy: Allow INSERT for Admins and Partners
CREATE POLICY "Allow admins and partners to insert events"
ON public.events
FOR INSERT
TO authenticated
WITH CHECK (public.get_user_role() IN ('admin', 'partner'));

-- Update Policy: Allow UPDATE for Admins and Partners
CREATE POLICY "Allow admins and partners to update events"
ON public.events
FOR UPDATE
TO authenticated
USING (public.get_user_role() IN ('admin', 'partner'))
WITH CHECK (public.get_user_role() IN ('admin', 'partner'));
