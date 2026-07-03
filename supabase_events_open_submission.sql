-- =============================================================
-- Open Submission + Admin Approval Pipeline for Events
-- =============================================================
-- This migration:
--   1. Adds a `status` column (pending | approved | rejected)
--   2. Replaces all RLS policies for granular access control
--   3. Opens storage uploads to any authenticated user
-- =============================================================

-- ─── 1. Add status column ────────────────────────────────────
ALTER TABLE public.events
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';

-- Add CHECK constraint (safe if column already exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'events_status_check'
  ) THEN
    ALTER TABLE public.events
    ADD CONSTRAINT events_status_check
    CHECK (status IN ('pending', 'approved', 'rejected'));
  END IF;
END $$;

-- Backfill: mark any existing events (created before this migration) as approved
UPDATE public.events SET status = 'approved' WHERE status IS NULL;

-- ─── 2. Drop old AND new RLS policies (idempotent) ───────────
DROP POLICY IF EXISTS "Allow authenticated users to read events" ON public.events;
DROP POLICY IF EXISTS "Allow admins and partners to insert events" ON public.events;
DROP POLICY IF EXISTS "Allow admins and partners to update events" ON public.events;
DROP POLICY IF EXISTS "events_select_policy" ON public.events;
DROP POLICY IF EXISTS "events_insert_policy" ON public.events;
DROP POLICY IF EXISTS "events_update_policy" ON public.events;
DROP POLICY IF EXISTS "events_delete_policy" ON public.events;

-- ─── 3. Create new RLS policies ──────────────────────────────

-- SELECT: Three-tier visibility
--   • Unauthenticated / any user → approved events only
--   • Authenticated user         → approved events + their own submissions (any status)
--   • Admin                      → everything
CREATE POLICY "events_select_policy" ON public.events
FOR SELECT
USING (
  -- Approved events are visible to everyone (including anon)
  status = 'approved'
  OR (
    -- Authenticated users can also see their own submissions
    auth.uid() IS NOT NULL
    AND organizer_id = auth.uid()
  )
  OR (
    -- Admins can see everything
    auth.uid() IS NOT NULL
    AND public.get_user_role() = 'admin'
  )
);

-- INSERT: Any authenticated user can submit a new event
CREATE POLICY "events_insert_policy" ON public.events
FOR INSERT
TO authenticated
WITH CHECK (true);

-- UPDATE: Only admins can update events (to change status, edit, etc.)
CREATE POLICY "events_update_policy" ON public.events
FOR UPDATE
TO authenticated
USING (public.get_user_role() = 'admin')
WITH CHECK (public.get_user_role() = 'admin');

-- DELETE: Only admins can delete events
CREATE POLICY "events_delete_policy" ON public.events
FOR DELETE
TO authenticated
USING (public.get_user_role() = 'admin');

-- ─── 4. Update storage policies for event-images bucket ──────
-- Allow any authenticated user to upload event images (was admin/partner only)
DROP POLICY IF EXISTS "Event images uploadable by admins and partners" ON storage.objects;
DROP POLICY IF EXISTS "Event images uploadable by authenticated users" ON storage.objects;

CREATE POLICY "Event images uploadable by authenticated users" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'event-images');
