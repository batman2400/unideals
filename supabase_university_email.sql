-- ============================================================
-- Uni Deals - Phase 6: University Email Verification (Post-Signup)
-- ============================================================
-- Run this AFTER supabase_student_verification.sql.
-- This script is idempotent and safe to re-run.
--
-- What this migration does:
-- 1) Adds public.user_roles.university_email (nullable TEXT)
-- 2) Creates verify_university_email() RPC function that:
--    - Validates domain (.ac.lk, .edu.lk, .edu)
--    - Updates user_roles with university_email + is_verified = true
-- 3) RLS allows authenticated users to call for their own row
-- ============================================================

-- 1) Add university_email column
ALTER TABLE public.user_roles
  ADD COLUMN IF NOT EXISTS university_email TEXT;

-- 2) Create RPC function for university email verification
CREATE OR REPLACE FUNCTION public.verify_university_email(uni_email TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  normalized TEXT := lower(trim(COALESCE(uni_email, '')));
  calling_user_id UUID := auth.uid();
BEGIN
  -- Validate caller is authenticated
  IF calling_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  -- Validate email format
  IF normalized = '' OR position('@' IN normalized) = 0 THEN
    RETURN json_build_object('success', false, 'error', 'Invalid email format');
  END IF;

  -- Validate university domain
  IF NOT (
    normalized ILIKE '%.ac.lk'
    OR normalized ILIKE '%.edu.lk'
    OR normalized ILIKE '%.edu'
  ) THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Email must end with .ac.lk, .edu.lk, or .edu'
    );
  END IF;

  -- Update user_roles with university email and set verified
  UPDATE public.user_roles
  SET university_email = normalized,
      is_verified = TRUE
  WHERE user_id = calling_user_id;

  -- Check if update hit a row
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'User role record not found');
  END IF;

  RETURN json_build_object('success', true, 'university_email', normalized);
END
$$;

-- 3) Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.verify_university_email(TEXT) TO authenticated;
