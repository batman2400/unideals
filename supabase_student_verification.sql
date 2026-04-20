-- ============================================================
-- Uni Deals - Phase 5: Automated Student Verification
-- ============================================================
-- Run this AFTER supabase_partner_access.sql.
-- This script is idempotent and safe to re-run.
--
-- What this migration does:
-- 1) Adds public.user_roles.is_verified (default false)
-- 2) Updates/creates public.handle_new_user_role() to auto-verify
--    eligible university email domains on signup
-- 3) Re-wires auth.users signup trigger to call handle_new_user_role()
-- 4) Backfills existing admin/partner users as verified
-- ============================================================

-- 1) Add verification column.
ALTER TABLE public.user_roles
  ADD COLUMN IF NOT EXISTS is_verified BOOLEAN NOT NULL DEFAULT FALSE;

-- 2) Create/replace signup role trigger function.
--    Matches ALL universities by suffix rules, case-insensitive:
--    - .ac.lk
--    - .edu.lk
--    - .edu
CREATE OR REPLACE FUNCTION public.handle_new_user_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  normalized_email TEXT := lower(COALESCE(trim(NEW.email), ''));
  email_is_verified BOOLEAN := FALSE;
BEGIN
  email_is_verified :=
    normalized_email ILIKE '%.ac.lk'
    OR normalized_email ILIKE '%.edu.lk'
    OR normalized_email ILIKE '%.edu';

  INSERT INTO public.user_roles (user_id, role, user_email, is_verified)
  VALUES (NEW.id, 'student', NEW.email, email_is_verified)
  ON CONFLICT (user_id) DO UPDATE
    SET user_email = EXCLUDED.user_email,
        is_verified = EXCLUDED.is_verified;

  RETURN NEW;
END
$$;

-- 3) Remove any existing auth.users triggers that call handle_new_user_role().
DO $$
DECLARE
  trigger_record RECORD;
BEGIN
  FOR trigger_record IN
    SELECT t.tgname
    FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_proc p ON p.oid = t.tgfoid
    JOIN pg_namespace pn ON pn.oid = p.pronamespace
    WHERE n.nspname = 'auth'
      AND c.relname = 'users'
      AND pn.nspname = 'public'
      AND p.proname = 'handle_new_user_role'
      AND NOT t.tgisinternal
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON auth.users', trigger_record.tgname);
  END LOOP;
END
$$;

-- Also drop common legacy trigger names if present.
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_created_set_role ON auth.users;

CREATE TRIGGER on_auth_user_created_set_role
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_role();

-- 4) Quick backfill for existing privileged users.
UPDATE public.user_roles
SET is_verified = TRUE
WHERE role IN ('admin', 'partner')
  AND is_verified IS DISTINCT FROM TRUE;
