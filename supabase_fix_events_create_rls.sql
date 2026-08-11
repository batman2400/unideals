-- =============================================================
-- Fix: RLS errors when creating events / uploading cover images
-- =============================================================
-- Run this in the Supabase SQL editor if event creation still fails
-- after deploying the app fix (upload path = `{userId}/filename`).
-- =============================================================

-- Drop legacy insert policy that only allowed admin/partner
DROP POLICY IF EXISTS "Allow admins and partners to insert events" ON public.events;

-- Ensure insert policy matches CreateEvent payload:
--   organizer_id = auth.uid() AND status = 'pending'
DROP POLICY IF EXISTS "events_insert_policy" ON public.events;
CREATE POLICY "events_insert_policy" ON public.events
  FOR INSERT
  TO authenticated
  WITH CHECK (
    organizer_id = auth.uid()
    AND status = 'pending'
  );

-- Cover image uploads: first path segment must be the uploader's uid
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
