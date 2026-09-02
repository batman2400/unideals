-- =============================================================
-- Fix: RLS errors when creating events / uploading cover images
-- =============================================================
-- Run this ENTIRE file in the production Supabase SQL editor.
-- Safe to re-run.
--
-- Smoke-test failures this covers:
--   • "new row violates row-level security policy" on event submit
--     (legacy policy only allowed admin/partner, or insert GRANT missing)
--   • Same RLS error when a student uploads a cover image
-- =============================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON public.events TO authenticated;
GRANT SELECT ON public.events TO anon;

-- Drop every known insert policy so a leftover admin/partner-only
-- check cannot block students.
DROP POLICY IF EXISTS "Allow admins and partners to insert events" ON public.events;
DROP POLICY IF EXISTS "events_insert_policy" ON public.events;

CREATE POLICY "events_insert_policy" ON public.events
  FOR INSERT
  TO authenticated
  WITH CHECK (
    organizer_id = auth.uid()
    AND status = 'pending'
  );

-- Server-side submit: organizer_id and status cannot be spoofed.
-- CreateEvent calls this RPC so insert does not depend on table RLS alone.
DROP FUNCTION IF EXISTS public.submit_pending_event(TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, TIMESTAMPTZ, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.submit_pending_event(
  p_title TEXT,
  p_description TEXT DEFAULT NULL,
  p_start_time TIMESTAMPTZ DEFAULT NULL,
  p_end_time TIMESTAMPTZ DEFAULT NULL,
  p_publish_at TIMESTAMPTZ DEFAULT NULL,
  p_location_name TEXT DEFAULT NULL,
  p_category TEXT DEFAULT NULL,
  p_university_name TEXT DEFAULT NULL,
  p_club_name TEXT DEFAULT NULL,
  p_cover_image_url TEXT DEFAULT NULL,
  p_target_audience TEXT DEFAULT 'all_students',
  p_external_registration_url TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_title IS NULL OR btrim(p_title) = '' THEN
    RAISE EXCEPTION 'Title is required';
  END IF;

  IF p_start_time IS NULL THEN
    RAISE EXCEPTION 'Start time is required';
  END IF;

  IF p_end_time IS NOT NULL AND p_end_time < p_start_time THEN
    RAISE EXCEPTION 'End time must be on or after the start time';
  END IF;

  INSERT INTO public.events (
    title,
    description,
    organizer_id,
    start_time,
    end_time,
    publish_at,
    location_name,
    category,
    university_name,
    club_name,
    cover_image_url,
    target_audience,
    external_registration_url,
    status
  ) VALUES (
    btrim(p_title),
    NULLIF(btrim(COALESCE(p_description, '')), ''),
    auth.uid(),
    p_start_time,
    p_end_time,
    COALESCE(p_publish_at, now()),
    NULLIF(btrim(COALESCE(p_location_name, '')), ''),
    COALESCE(NULLIF(btrim(COALESCE(p_category, '')), ''), 'social'),
    NULLIF(btrim(COALESCE(p_university_name, '')), ''),
    NULLIF(btrim(COALESCE(p_club_name, '')), ''),
    NULLIF(btrim(COALESCE(p_cover_image_url, '')), ''),
    COALESCE(NULLIF(btrim(COALESCE(p_target_audience, '')), ''), 'all_students'),
    NULLIF(btrim(COALESCE(p_external_registration_url, '')), ''),
    'pending'
  )
  RETURNING id INTO new_id;

  RETURN new_id;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_pending_event(
  TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, TIMESTAMPTZ, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_pending_event(
  TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, TIMESTAMPTZ, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT
) TO authenticated;

NOTIFY pgrst, 'reload schema';

-- Cover images: first path segment must be the uploader's uid
DROP POLICY IF EXISTS "Event images uploadable by admins and partners" ON storage.objects;
DROP POLICY IF EXISTS "Event images uploadable by authenticated users" ON storage.objects;
DROP POLICY IF EXISTS "Event images uploadable by owner" ON storage.objects;

CREATE POLICY "Event images uploadable by owner" ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'event-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Event images publicly accessible" ON storage.objects;
CREATE POLICY "Event images publicly accessible" ON storage.objects
  FOR SELECT
  USING (bucket_id = 'event-images');

-- Confirm what is live (insert policy should mention organizer_id + pending)
SELECT policyname, cmd, roles, with_check
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'events'
ORDER BY cmd, policyname;
