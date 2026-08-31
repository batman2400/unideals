-- Yearly student verification
--
-- Run in the Supabase SQL editor against the shared Uni Deals project.
-- Students stay verified for 1 year from the last approval, then must
-- re-verify to keep deal codes and tickets.
--
-- After this file, re-run `supabase_student_verification_admin_gate.sql`
-- so the same student ID can be submitted again on renewal.
-- Then open the app or website once (or wait for the daily job) so stale
-- `is_verified` flags are cleared.

ALTER TABLE public.user_roles
  ADD COLUMN IF NOT EXISTS verified_at timestamptz;

COMMENT ON COLUMN public.user_roles.verified_at IS
  'When student verification was last granted. Students must re-verify after 1 year.';

-- Best-effort timestamp for people already verified. Swap `created_at` for
-- `now()` if you want every current student to get a fresh 12-month window.
UPDATE public.user_roles
SET verified_at = COALESCE(verified_at, created_at, now())
WHERE is_verified = true
  AND verified_at IS NULL;

CREATE INDEX IF NOT EXISTS user_roles_stale_student_verification_idx
  ON public.user_roles (verified_at)
  WHERE role = 'student' AND is_verified = true;

CREATE OR REPLACE FUNCTION public.stamp_student_verified_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.role = 'student' AND NEW.is_verified IS TRUE THEN
    IF TG_OP = 'INSERT' OR OLD.is_verified IS DISTINCT FROM TRUE THEN
      NEW.verified_at := COALESCE(NEW.verified_at, now());
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS user_roles_stamp_verified_at ON public.user_roles;
CREATE TRIGGER user_roles_stamp_verified_at
  BEFORE INSERT OR UPDATE OF is_verified, role
  ON public.user_roles
  FOR EACH ROW
  EXECUTE PROCEDURE public.stamp_student_verified_at();

-- Refresh verified_at on re-approval even when the student is still marked
-- verified (renewal before the year is up).
CREATE OR REPLACE FUNCTION public.stamp_verified_at_on_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'approved'
     AND (OLD.status IS DISTINCT FROM 'approved')
     AND NEW.user_id IS NOT NULL THEN
    UPDATE public.user_roles
    SET is_verified = true,
        verified_at = now()
    WHERE user_id = NEW.user_id
      AND role = 'student';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS manual_verifications_stamp_verified_at ON public.manual_verifications;
CREATE TRIGGER manual_verifications_stamp_verified_at
  AFTER UPDATE OF status
  ON public.manual_verifications
  FOR EACH ROW
  EXECUTE PROCEDURE public.stamp_verified_at_on_approval();

CREATE OR REPLACE FUNCTION public.student_verification_is_current(
  p_user_id uuid DEFAULT auth.uid()
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = p_user_id
      AND ur.is_verified = true
      AND (
        ur.role <> 'student'
        OR (
          ur.verified_at IS NOT NULL
          AND ur.verified_at > now() - interval '1 year'
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.expire_stale_student_verifications()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected integer;
BEGIN
  UPDATE public.user_roles
  SET is_verified = false
  WHERE role = 'student'
    AND is_verified = true
    AND verified_at IS NOT NULL
    AND verified_at <= now() - interval '1 year';

  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$;

REVOKE ALL ON FUNCTION public.student_verification_is_current(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.expire_stale_student_verifications() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.student_verification_is_current(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.expire_stale_student_verifications() TO authenticated;
GRANT EXECUTE ON FUNCTION public.student_verification_is_current(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.expire_stale_student_verifications() TO service_role;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'cron') THEN
    PERFORM cron.unschedule('expire-student-verifications-daily');
  END IF;
EXCEPTION
  WHEN undefined_function THEN
    NULL;
  WHEN undefined_object THEN
    NULL;
END;
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'cron') THEN
    PERFORM cron.schedule(
      'expire-student-verifications-daily',
      '15 3 * * *',
      $cron$SELECT public.expire_stale_student_verifications();$cron$
    );
  END IF;
EXCEPTION
  WHEN undefined_function THEN
    NULL;
  WHEN undefined_object THEN
    NULL;
END;
$$;

-- Same student may re-verify yearly with the same ID. Only one in-flight
-- request per ID is unique; another account still cannot claim an approved ID.
DROP INDEX IF EXISTS public.manual_verifications_active_student_id_idx;

CREATE UNIQUE INDEX IF NOT EXISTS manual_verifications_inflight_student_id_idx
  ON public.manual_verifications (public.normalize_student_id(student_id_number))
  WHERE status IN ('pending', 'awaiting_confirmation')
    AND public.normalize_student_id(student_id_number) IS NOT NULL;

CREATE OR REPLACE FUNCTION public.student_id_conflicts(
  p_normalized_id text,
  p_caller uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(p_normalized_id, '') <> '' AND EXISTS (
    SELECT 1
    FROM public.manual_verifications
    WHERE public.normalize_student_id(student_id_number) = p_normalized_id
      AND (
        status IN ('pending', 'awaiting_confirmation')
        OR (status = 'approved' AND user_id IS DISTINCT FROM p_caller)
      )
  );
$$;
