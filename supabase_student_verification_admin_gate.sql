-- ============================================================
-- Uni Deals — student verification admin gate
--
-- Run `supabase_yearly_student_verification.sql` first (adds
-- verified_at, student_id_conflicts, and the 12-month expiry job).
-- Then run this file and redeploy edge functions:
--   send-verification-otp, send-event-approved,
--   send-inquiry-notification, send-verification-rejected
--
-- Until this runs, confirm_university_verification still sets
-- is_verified = true (instant OTP verify) and handle_new_user_role
-- may still auto-verify .edu / .ac.lk on signup.
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. Allowed institute emails: subdomain match + SL seed
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_allowed_student_domain(candidate_email TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  normalized TEXT := lower(trim(COALESCE(candidate_email, '')));
  domain_part TEXT;
BEGIN
  IF normalized = '' OR position('@' IN normalized) = 0 THEN
    RETURN FALSE;
  END IF;

  IF (
    normalized LIKE '%.ac.lk' OR normalized LIKE '%.edu.lk' OR
    normalized LIKE '%.sliit.lk' OR normalized LIKE '%.edu' OR
    normalized LIKE '%.edu.au' OR normalized LIKE '%.ac.uk'
  ) THEN
    RETURN TRUE;
  END IF;

  domain_part := substr(normalized, position('@' IN normalized) + 1);

  RETURN EXISTS (
    SELECT 1
    FROM public.allowed_domains allowed
    WHERE domain_part = allowed.domain
       OR domain_part LIKE '%.' || allowed.domain
  );
END
$$;

GRANT EXECUTE ON FUNCTION public.is_allowed_student_domain(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_allowed_student_domain(TEXT) TO service_role;

INSERT INTO public.allowed_domains (domain, institution_name)
VALUES
  ('nibm.lk', 'National Institute of Business Management'),
  ('cinec.edu', 'CINEC Campus'),
  ('cinec.lk', 'CINEC Campus'),
  ('sliit.lk', 'Sri Lanka Institute of Information Technology'),
  ('kiu.lk', 'KIU'),
  ('esoft.lk', 'ESOFT Metro Campus'),
  ('niibs.lk', 'Nagananda International Institute for Buddhist Studies'),
  ('sanasacampus.lk', 'SANASA Campus'),
  ('aquinas.lk', 'Aquinas College of Higher Studies'),
  ('casrilanka.com', 'CA Sri Lanka'),
  ('slintec.lk', 'Sri Lanka Institute of Nanotechnology'),
  ('icbt.lk', 'ICBT Campus'),
  ('bci.lk', 'BCI'),
  ('ric.lk', 'Royal Institute of Colombo'),
  ('bms.lk', 'BMS'),
  ('lnbti.lk', 'Lanka Nippon BizTech Institute'),
  ('gatewaycollege.lk', 'Gateway College'),
  ('itsuniversity.lk', 'ITS University'),
  ('nsbm.lk', 'NSBM Green University'),
  ('iit.lk', 'Informatics Institute of Technology'),
  ('apiit.lk', 'Asia Pacific Institute of Information Technology')
ON CONFLICT (domain) DO UPDATE
SET institution_name = EXCLUDED.institution_name;

-- ────────────────────────────────────────────────────────────
-- 2. Schema: method, statuses, back of ID, reject reason
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.manual_verifications
  ADD COLUMN IF NOT EXISTS method TEXT NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS proof_image_back_url TEXT,
  ADD COLUMN IF NOT EXISTS reject_reason TEXT;

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.manual_verifications'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%status%'
  LOOP
    EXECUTE format(
      'ALTER TABLE public.manual_verifications DROP CONSTRAINT %I',
      r.conname
    );
  END LOOP;
END $$;

ALTER TABLE public.manual_verifications
  ADD CONSTRAINT manual_verifications_status_check
  CHECK (status IN ('pending', 'awaiting_confirmation', 'approved', 'rejected'));

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.manual_verifications'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%method%'
  LOOP
    EXECUTE format(
      'ALTER TABLE public.manual_verifications DROP CONSTRAINT %I',
      r.conname
    );
  END LOOP;
END $$;

ALTER TABLE public.manual_verifications
  ADD CONSTRAINT manual_verifications_method_check
  CHECK (method IN ('email_otp', 'manual'));

CREATE OR REPLACE FUNCTION public.normalize_student_id(raw TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT NULLIF(lower(trim(COALESCE(raw, ''))), '');
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'manual_verifications_active_student_id_idx'
      AND n.nspname = 'public'
  ) THEN
    BEGIN
      CREATE UNIQUE INDEX manual_verifications_active_student_id_idx
        ON public.manual_verifications (public.normalize_student_id(student_id_number))
        WHERE status <> 'rejected'
          AND public.normalize_student_id(student_id_number) IS NOT NULL;
    EXCEPTION WHEN unique_violation THEN
      RAISE NOTICE 'Skipped unique student ID index because duplicate active IDs already exist.';
    END;
  END IF;
END $$;

-- ────────────────────────────────────────────────────────────
-- 3. OTP confirm: prove inbox ownership, queue for admin
--    Does NOT set is_verified.
-- ────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.confirm_university_verification(TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.confirm_university_verification(
  entered_email TEXT,
  entered_code TEXT,
  inst_name TEXT,
  course TEXT,
  student_id TEXT,
  image_url TEXT,
  image_back_url TEXT
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
  normalized_id TEXT := public.normalize_student_id(student_id);
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

  IF trim(COALESCE(inst_name, '')) = ''
     OR trim(COALESCE(course, '')) = ''
     OR normalized_id IS NULL
     OR trim(COALESCE(image_url, '')) = ''
     OR trim(COALESCE(image_back_url, '')) = '' THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Institution, course, student ID, and both sides of your student ID are required.'
    );
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

  IF EXISTS (
    SELECT 1 FROM public.manual_verifications
    WHERE user_id = calling_user_id
      AND status IN ('pending', 'awaiting_confirmation')
  ) THEN
    RETURN json_build_object('success', false, 'error',
      'You already have a verification request awaiting review.');
  END IF;

  IF public.student_id_conflicts(normalized_id, calling_user_id) THEN
    RETURN json_build_object('success', false, 'error',
      'This student ID is already linked to another verification request.');
  END IF;

  UPDATE public.user_roles
  SET university_email = normalized
  WHERE user_id = calling_user_id;

  INSERT INTO public.manual_verifications (
    user_id,
    method,
    status,
    institution_type,
    institution_name,
    course_details,
    student_id_number,
    contact_email,
    proof_image_url,
    proof_image_back_url,
    reject_reason
  ) VALUES (
    calling_user_id,
    'email_otp',
    'awaiting_confirmation',
    'university',
    trim(inst_name),
    trim(course),
    trim(student_id),
    normalized,
    trim(image_url),
    trim(image_back_url),
    NULL
  );

  DELETE FROM public.verification_otps WHERE user_id = calling_user_id;

  RETURN json_build_object(
    'success', true,
    'message', 'Email confirmed. An admin will review your student ID next.'
  );
END
$$;

GRANT EXECUTE ON FUNCTION public.confirm_university_verification(
  TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT
) TO authenticated;

-- ────────────────────────────────────────────────────────────
-- 4. Manual / school submit
-- ────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.submit_manual_verification(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.submit_manual_verification(
  inst_type TEXT,
  inst_name TEXT,
  course TEXT,
  student_id TEXT,
  email TEXT,
  image_url TEXT,
  image_back_url TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  calling_user_id UUID := auth.uid();
  normalized_type TEXT := lower(trim(COALESCE(inst_type, '')));
  normalized_id TEXT := public.normalize_student_id(student_id);
BEGIN
  IF calling_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  IF normalized_type NOT IN ('university', 'school') THEN
    RETURN json_build_object('success', false, 'error', 'Institution type must be university or school.');
  END IF;

  IF trim(COALESCE(inst_name, '')) = ''
     OR trim(COALESCE(image_url, '')) = ''
     OR trim(COALESCE(image_back_url, '')) = '' THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Institution name and both sides of your student ID are required.'
    );
  END IF;

  IF normalized_type = 'university' AND (
       trim(COALESCE(course, '')) = '' OR normalized_id IS NULL
     ) THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Course details and student ID are required for university verification.'
    );
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.manual_verifications
    WHERE user_id = calling_user_id
      AND status IN ('pending', 'awaiting_confirmation')
  ) THEN
    RETURN json_build_object('success', false, 'error',
      'You already have a pending verification request.');
  END IF;

  IF public.student_id_conflicts(normalized_id, calling_user_id) THEN
    RETURN json_build_object('success', false, 'error',
      'This student ID is already linked to another verification request.');
  END IF;

  INSERT INTO public.manual_verifications (
    user_id,
    method,
    status,
    institution_type,
    institution_name,
    course_details,
    student_id_number,
    contact_email,
    proof_image_url,
    proof_image_back_url,
    reject_reason
  ) VALUES (
    calling_user_id,
    'manual',
    'pending',
    normalized_type,
    trim(inst_name),
    NULLIF(trim(COALESCE(course, '')), ''),
    NULLIF(trim(COALESCE(student_id, '')), ''),
    lower(trim(COALESCE(email, ''))),
    trim(image_url),
    trim(image_back_url),
    NULL
  );

  RETURN json_build_object('success', true, 'message', 'Verification request submitted successfully.');
END
$$;

GRANT EXECUTE ON FUNCTION public.submit_manual_verification(
  TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT
) TO authenticated;

-- ────────────────────────────────────────────────────────────
-- 5. Admin approve / reject
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.approve_manual_verification(request_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  approved_user_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  IF public.get_user_role() <> 'admin' THEN
    RETURN json_build_object('success', false, 'error', 'Unauthorized. Admin access required.');
  END IF;

  UPDATE public.manual_verifications
  SET status = 'approved', updated_at = NOW(), reject_reason = NULL
  WHERE id = request_id
    AND status IN ('pending', 'awaiting_confirmation')
  RETURNING user_id INTO approved_user_id;

  IF approved_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Pending request not found.');
  END IF;

  UPDATE public.user_roles
  SET is_verified = TRUE,
      verified_at = now()
  WHERE user_id = approved_user_id;

  RETURN json_build_object('success', true, 'message', 'Request approved and user verified.');
END
$$;

GRANT EXECUTE ON FUNCTION public.approve_manual_verification(UUID) TO authenticated;

DROP FUNCTION IF EXISTS public.reject_manual_verification(UUID);

CREATE OR REPLACE FUNCTION public.reject_manual_verification(
  request_id UUID,
  reason TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  rejected_user_id UUID;
  cleaned_reason TEXT := trim(COALESCE(reason, ''));
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  IF public.get_user_role() <> 'admin' THEN
    RETURN json_build_object('success', false, 'error', 'Unauthorized. Admin access required.');
  END IF;

  IF cleaned_reason = '' THEN
    RETURN json_build_object('success', false, 'error', 'A reject reason is required.');
  END IF;

  UPDATE public.manual_verifications
  SET status = 'rejected',
      reject_reason = cleaned_reason,
      updated_at = NOW()
  WHERE id = request_id
    AND status IN ('pending', 'awaiting_confirmation')
  RETURNING user_id INTO rejected_user_id;

  IF rejected_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Pending request not found.');
  END IF;

  RETURN json_build_object('success', true, 'message', 'Request rejected.');
END
$$;

GRANT EXECUTE ON FUNCTION public.reject_manual_verification(UUID, TEXT) TO authenticated;

-- ────────────────────────────────────────────────────────────
-- 6. Signup trigger: NEVER auto-verify from email domain
--    Older supabase_student_verification.sql set is_verified for
--    .edu / .ac.lk on insert. That skipped the admin queue.
--    Re-apply this file after any older verification SQL.
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role, user_email, is_verified)
  VALUES (NEW.id, 'student', NEW.email, FALSE)
  ON CONFLICT (user_id) DO UPDATE
    SET user_email = EXCLUDED.user_email,
        is_verified = CASE
          WHEN public.user_roles.role IN ('admin', 'partner') THEN TRUE
          ELSE public.user_roles.is_verified
        END;

  RETURN NEW;
END
$$;

NOTIFY pgrst, 'reload schema';

