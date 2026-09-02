-- ============================================================
-- Uni Deals — university email OTP verifies immediately
--
-- Apply in the Supabase SQL editor AFTER
-- supabase_student_verification_admin_gate.sql.
--
-- Correct OTP + allowed institute email now sets is_verified.
-- Student ID photos stay required only for the manual / school path.
-- Signup still does NOT auto-verify from the email domain.
-- ============================================================

ALTER TABLE public.user_roles
  ADD COLUMN IF NOT EXISTS institution_name TEXT;

DROP FUNCTION IF EXISTS public.confirm_university_verification(TEXT, TEXT);
DROP FUNCTION IF EXISTS public.confirm_university_verification(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.confirm_university_verification(
  entered_email TEXT,
  entered_code TEXT,
  inst_name TEXT,
  course TEXT DEFAULT NULL,
  student_id TEXT DEFAULT NULL,
  image_url TEXT DEFAULT NULL,
  image_back_url TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  normalized TEXT := lower(trim(COALESCE(entered_email, '')));
  calling_user_id UUID := auth.uid();
  otp_record RECORD;
  expected_hash TEXT;
  cleaned_inst TEXT := trim(COALESCE(inst_name, ''));
BEGIN
  IF calling_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  IF NOT public.is_allowed_student_domain(normalized) THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Email domain not recognized. Please use your official university email.'
    );
  END IF;

  IF cleaned_inst = '' THEN
    RETURN json_build_object('success', false, 'error', 'Please choose your university.');
  END IF;

  DELETE FROM public.verification_otps WHERE expires_at < now();

  SELECT * INTO otp_record
  FROM public.verification_otps
  WHERE user_id = calling_user_id
    AND target_email = normalized
  ORDER BY created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Invalid or expired verification code.');
  END IF;

  IF otp_record.attempts >= 5 THEN
    DELETE FROM public.verification_otps WHERE id = otp_record.id;
    RETURN json_build_object('success', false, 'error',
      'Too many incorrect attempts. Please request a new code.');
  END IF;

  expected_hash := encode(
    digest(COALESCE(entered_code, '') || calling_user_id::text, 'sha256'), 'hex');

  IF otp_record.otp_hash IS DISTINCT FROM expected_hash THEN
    UPDATE public.verification_otps SET attempts = attempts + 1 WHERE id = otp_record.id;
    RETURN json_build_object('success', false, 'error', 'Invalid or expired verification code.');
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE university_email = normalized AND user_id <> calling_user_id
  ) THEN
    RETURN json_build_object('success', false, 'error',
      'This email is already associated with another account.');
  END IF;

  UPDATE public.user_roles
  SET university_email = normalized,
      institution_name = cleaned_inst,
      is_verified = TRUE,
      verified_at = now()
  WHERE user_id = calling_user_id;

  UPDATE public.manual_verifications
  SET status = 'approved',
      updated_at = now(),
      reject_reason = NULL
  WHERE user_id = calling_user_id
    AND status IN ('pending', 'awaiting_confirmation');

  DELETE FROM public.verification_otps WHERE user_id = calling_user_id;

  RETURN json_build_object('success', true, 'message', 'University email successfully verified.');
END
$$;

GRANT EXECUTE ON FUNCTION public.confirm_university_verification(
  TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT
) TO authenticated;

NOTIFY pgrst, 'reload schema';
