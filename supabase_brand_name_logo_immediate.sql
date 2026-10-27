-- Approved partners edit their public name and logo immediately.
-- Run this once in the Supabase SQL editor on a project that already has
-- supabase_brand_applications.sql. Safe to re-run.
--
-- Any name or logo change still sitting in the review queue is cleared.
-- The partner saves again from Brand profile and that edit goes live.

CREATE OR REPLACE FUNCTION public.guard_brand_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF public.get_user_role() = 'admin'
     OR auth.uid() IS NULL
     OR current_setting('app.brand_admin_write', true) = '1' THEN
    RETURN NEW;
  END IF;

  NEW.status := OLD.status;
  NEW.applicant_user_id := OLD.applicant_user_id;
  NEW.reviewed_by := OLD.reviewed_by;
  NEW.reviewed_at := OLD.reviewed_at;
  NEW.rejection_reason := OLD.rejection_reason;
  NEW.pending_name := NULL;
  NEW.pending_logo_url := NULL;
  NEW.profile_review_status := 'none';
  NEW.profile_review_note := NULL;

  RETURN NEW;
END;
$$;

UPDATE public.brands
SET
  pending_name = NULL,
  pending_logo_url = NULL,
  profile_review_status = 'none',
  profile_review_note = NULL
WHERE profile_review_status = 'pending';
