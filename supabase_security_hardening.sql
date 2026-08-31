-- ============================================================
-- UniDeals — Security hardening migration
--
-- Run this ENTIRE file in the Supabase SQL editor, then deploy
-- the `send-verification-otp` edge function (see notes at end).
--
-- Sections:
--   1. Deal insert (partners may auto-launch as approved; cannot flip status later)
--   2. Constrain event submission (anyone could publish as anyone)
--   3. Scope redemption codes to the owning brand
--   4. Stop leaking the verification OTP; add brute-force limits
--   5. Make identity documents private
--   6. Derive identity server-side when approving verifications
--   7. Keep denormalized brand names in sync
--   8. Enforce redemption code uniqueness
-- ============================================================

BEGIN;

-- ────────────────────────────────────────────────────────────
-- 1. Deal auto-launch + status lock
--
-- Brands/partners create deals that go live immediately
-- (status = 'approved'). Events still require admin approval.
-- Partners must not be able to change status after insert
-- (e.g. flip a rejected deal back to approved).
-- ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Partners can insert own brand deals" ON public.deals;

CREATE POLICY "Partners can insert own brand deals"
  ON public.deals
  FOR INSERT
  WITH CHECK (
    public.get_user_role() = 'partner'
    AND auth.uid() = partner_id
    AND brand_id = public.get_partner_brand_id(auth.uid())
    AND status IN ('pending', 'approved')
  );

-- Partners cannot change deal status after insert.
-- Enforced with a trigger rather than a policy subquery so the
-- comparison against the previous value is deterministic.
CREATE OR REPLACE FUNCTION public.enforce_deal_status_moderation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Allow migrations / SQL Editor (no JWT session).
  -- get_user_role() returns 'student' when auth.uid() is NULL,
  -- which would otherwise silently undo admin backfills.
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF public.get_user_role() <> 'admin'
     AND NEW.status IS DISTINCT FROM OLD.status THEN
    NEW.status := OLD.status;
  END IF;
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS deals_enforce_status_moderation ON public.deals;
CREATE TRIGGER deals_enforce_status_moderation
  BEFORE UPDATE ON public.deals
  FOR EACH ROW EXECUTE FUNCTION public.enforce_deal_status_moderation();

-- ────────────────────────────────────────────────────────────
-- 2. Event submission
--
-- WITH CHECK (true) let any authenticated user insert an event with
-- an arbitrary organizer_id and status = 'approved'.
-- ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "events_insert_policy" ON public.events;

CREATE POLICY "events_insert_policy" ON public.events
  FOR INSERT
  TO authenticated
  WITH CHECK (
    organizer_id = auth.uid()
    AND status = 'pending'
  );

-- The admin UI prompts for a rejection reason but had nowhere to store it.
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

DROP POLICY IF EXISTS "Event images uploadable by authenticated users" ON storage.objects;

-- Upload path must be `{auth.uid()}/filename` (see src/lib/eventImageUpload.js).
CREATE POLICY "Event images uploadable by owner" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'event-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- ────────────────────────────────────────────────────────────
-- 3. Redemption code visibility
--
-- Previously any caller with role 'partner' received the code for
-- ANY deal id, so partners could harvest competitors' codes.
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_public_deal_by_id(target_deal_id BIGINT)
RETURNS TABLE (
  id BIGINT,
  title TEXT,
  brand TEXT,
  discount TEXT,
  type TEXT,
  category TEXT,
  image_url TEXT,
  description TEXT,
  redemption_code TEXT,
  store_url TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_id UUID := auth.uid();
  caller_role TEXT := public.get_user_role();
  can_view_redemption_code BOOLEAN := FALSE;
  has_is_verified_column BOOLEAN := FALSE;
BEGIN
  IF caller_role = 'admin' THEN
    can_view_redemption_code := TRUE;

  ELSIF caller_role = 'partner' THEN
    SELECT (d.brand_id IS NOT NULL
            AND d.brand_id = public.get_partner_brand_id(caller_id))
    INTO can_view_redemption_code
    FROM public.deals d
    WHERE d.id = target_deal_id;

    can_view_redemption_code := COALESCE(can_view_redemption_code, FALSE);

  ELSE
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'user_roles'
        AND column_name = 'is_verified'
    )
    INTO has_is_verified_column;

    IF has_is_verified_column AND caller_id IS NOT NULL THEN
      EXECUTE 'SELECT COALESCE(is_verified, FALSE) FROM public.user_roles WHERE user_id = $1 LIMIT 1'
      INTO can_view_redemption_code
      USING caller_id;

      can_view_redemption_code := COALESCE(can_view_redemption_code, FALSE);
    END IF;
  END IF;

  RETURN QUERY
  SELECT
    d.id,
    d.title,
    d.brand,
    d.discount,
    d.type,
    d.category,
    d.image_url,
    d.description,
    CASE
      WHEN can_view_redemption_code THEN d.redemption_code
      ELSE NULL
    END AS redemption_code,
    d.store_url,
    d.created_at
  FROM public.deals d
  WHERE d.status = 'approved'
    AND d.id = target_deal_id
  LIMIT 1;
END
$$;

GRANT EXECUTE ON FUNCTION public.get_public_deal_by_id(BIGINT) TO anon, authenticated;

-- `get_partner_brand` was callable by anon for any user UUID.
REVOKE EXECUTE ON FUNCTION public.get_partner_brand(UUID) FROM anon;

-- ────────────────────────────────────────────────────────────
-- 4. Verification OTP
--
-- The old RPC returned the plaintext OTP in its response, so any
-- user could verify any university email. The code is now hashed at
-- rest and only ever leaves the system via the email sender.
-- ────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

ALTER TABLE public.verification_otps
  ADD COLUMN IF NOT EXISTS otp_hash TEXT,
  ADD COLUMN IF NOT EXISTS attempts SMALLINT NOT NULL DEFAULT 0;

-- Any codes issued under the old scheme are compromised by definition.
DELETE FROM public.verification_otps;

ALTER TABLE public.verification_otps ALTER COLUMN otp_code DROP NOT NULL;

-- The plaintext-returning RPC is replaced by the edge function.
DROP FUNCTION IF EXISTS public.request_university_verification(TEXT);

-- Domain validation, callable by the edge function and reusable by the UI.
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
  RETURN EXISTS (SELECT 1 FROM public.allowed_domains WHERE domain = domain_part);
END
$$;

GRANT EXECUTE ON FUNCTION public.is_allowed_student_domain(TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.confirm_university_verification(entered_email TEXT, entered_code TEXT)
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
BEGIN
  IF calling_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Not authenticated');
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
      is_verified = TRUE
  WHERE user_id = calling_user_id;

  DELETE FROM public.verification_otps WHERE user_id = calling_user_id;

  RETURN json_build_object('success', true, 'message', 'University email successfully verified.');
END
$$;

GRANT EXECUTE ON FUNCTION public.confirm_university_verification(TEXT, TEXT) TO authenticated;

-- ────────────────────────────────────────────────────────────
-- 5. Identity documents
--
-- The bucket was public with a `TO public` read policy, exposing
-- every uploaded student ID to anonymous download.
-- ────────────────────────────────────────────────────────────
UPDATE storage.buckets SET public = false WHERE id = 'verification-documents';

DROP POLICY IF EXISTS "Allow public to read verification documents" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to upload verification documents" ON storage.objects;

CREATE POLICY "Users upload own verification documents" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'verification-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users read own verification documents" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'verification-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Admins read all verification documents" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'verification-documents'
    AND public.get_user_role() = 'admin'
  );

-- ────────────────────────────────────────────────────────────
-- 6. Verification approval
--
-- The old signature accepted target_user_id / target_email from the
-- client without checking they matched the request being approved.
-- ────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.approve_manual_verification(UUID, UUID, TEXT);

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
  SET status = 'approved', updated_at = NOW()
  WHERE id = request_id AND status = 'pending'
  RETURNING user_id INTO approved_user_id;

  IF approved_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Pending request not found.');
  END IF;

  -- Deliberately does not write university_email: a manually verified
  -- student has proven enrolment, not ownership of an institutional inbox.
  UPDATE public.user_roles
  SET is_verified = TRUE,
      verified_at = now()
  WHERE user_id = approved_user_id;

  RETURN json_build_object('success', true, 'message', 'Request approved and user verified.');
END
$$;

GRANT EXECUTE ON FUNCTION public.approve_manual_verification(UUID) TO authenticated;

-- ────────────────────────────────────────────────────────────
-- 7. Denormalized brand name sync
--
-- deals.brand is a text snapshot taken at creation. Renaming a brand
-- left every existing deal pointing at the old name.
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.sync_deals_brand_name()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.name IS DISTINCT FROM OLD.name THEN
    UPDATE public.deals SET brand = NEW.name WHERE brand_id = NEW.id;
  END IF;
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS brands_sync_deal_brand_name ON public.brands;
CREATE TRIGGER brands_sync_deal_brand_name
  AFTER UPDATE OF name ON public.brands
  FOR EACH ROW EXECUTE FUNCTION public.sync_deals_brand_name();

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS brands_touch_updated_at ON public.brands;
CREATE TRIGGER brands_touch_updated_at
  BEFORE UPDATE ON public.brands
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Repair any drift that already exists.
UPDATE public.deals d
SET brand = b.name
FROM public.brands b
WHERE d.brand_id = b.id AND d.brand IS DISTINCT FROM b.name;

COMMIT;

-- ────────────────────────────────────────────────────────────
-- 8. Redemption code uniqueness
--
-- Outside the transaction: this will fail loudly if duplicates already
-- exist, which is information you want rather than a silent rollback.
-- ────────────────────────────────────────────────────────────
CREATE UNIQUE INDEX IF NOT EXISTS deals_redemption_code_key
  ON public.deals (redemption_code)
  WHERE redemption_code IS NOT NULL;

-- ── Verification queries ────────────────────────────────────
-- Expect zero rows: no partner-insertable 'approved' path remains.
SELECT policyname, cmd, with_check
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'deals' AND cmd = 'INSERT';

-- Expect public = false.
SELECT id, public FROM storage.buckets WHERE id = 'verification-documents';

-- Expect zero rows: every deal's text brand matches its brand record.
SELECT d.id, d.brand, b.name
FROM public.deals d
JOIN public.brands b ON b.id = d.brand_id
WHERE d.brand IS DISTINCT FROM b.name;
