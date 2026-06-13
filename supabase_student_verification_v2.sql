-- ============================================================
-- Uni Deals - Phase 7: OTP-Based Student Email Verification
-- ============================================================

-- 1) Create allowed_domains table for custom whitelisted institutions
CREATE TABLE IF NOT EXISTS public.allowed_domains (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain TEXT UNIQUE NOT NULL,
  institution_name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS and grant SELECT to authenticated users
ALTER TABLE public.allowed_domains ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow authenticated users to read allowed_domains" 
  ON public.allowed_domains FOR SELECT TO authenticated USING (true);

-- Seed the initial whitelist
INSERT INTO public.allowed_domains (domain, institution_name)
VALUES 
  ('nibm.lk', 'National Institute of Business Management'),
  ('nsbm.ac.lk', 'NSBM Green University'),
  ('iit.ac.lk', 'Informatics Institute of Technology'),
  ('saegis.ac.lk', 'Saegis Campus'),
  ('cinec.edu', 'CINEC Campus')
ON CONFLICT (domain) DO NOTHING;

-- 2) Create verification_otps table to store active OTP requests
CREATE TABLE IF NOT EXISTS public.verification_otps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  target_email TEXT NOT NULL,
  otp_code VARCHAR(6) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT NOW() + interval '15 minutes'
);

-- Enable RLS (RPCs handle logic, so standard users can't read/write directly)
ALTER TABLE public.verification_otps ENABLE ROW LEVEL SECURITY;

-- 3) Enforce UNIQUE constraint on user_roles.university_email
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_roles_university_email_key'
  ) THEN
    ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_university_email_key UNIQUE (university_email);
  END IF;
END $$;

-- 4) Create RPC to request a verification OTP
CREATE OR REPLACE FUNCTION public.request_university_verification(target_email TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  normalized TEXT := lower(trim(COALESCE(target_email, '')));
  calling_user_id UUID := auth.uid();
  domain_part TEXT;
  is_valid_domain BOOLEAN := false;
  generated_otp TEXT;
BEGIN
  -- Validate caller is authenticated
  IF calling_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  -- Validate email format
  IF normalized = '' OR position('@' IN normalized) = 0 THEN
    RETURN json_build_object('success', false, 'error', 'Invalid email format');
  END IF;

  -- Extract domain part
  domain_part := substr(normalized, position('@' IN normalized) + 1);

  -- Hybrid Domain Check (Universal Suffixes OR Allowed Domains table)
  IF (
    normalized ILIKE '%.ac.lk' OR
    normalized ILIKE '%.edu.lk' OR
    normalized ILIKE '%.sliit.lk' OR
    normalized ILIKE '%.edu' OR
    normalized ILIKE '%.edu.au' OR
    normalized ILIKE '%.ac.uk'
  ) THEN
    is_valid_domain := true;
  ELSE
    SELECT EXISTS (
      SELECT 1 FROM public.allowed_domains WHERE domain = domain_part
    ) INTO is_valid_domain;
  END IF;

  IF NOT is_valid_domain THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Email domain not recognized. Please use your official university email.'
    );
  END IF;
  
  -- Check if email is already used by someone else
  IF EXISTS (SELECT 1 FROM public.user_roles WHERE university_email = normalized AND user_id != calling_user_id) THEN
    RETURN json_build_object('success', false, 'error', 'This email is already associated with another account.');
  END IF;

  -- Generate 6-digit OTP
  generated_otp := lpad(floor(random() * 1000000)::text, 6, '0');

  -- Remove existing OTPs for this user to prevent spam/clutter
  DELETE FROM public.verification_otps WHERE user_id = calling_user_id;

  -- Insert new OTP
  INSERT INTO public.verification_otps (user_id, target_email, otp_code)
  VALUES (calling_user_id, normalized, generated_otp);

  -- Return success (in production, we'd trigger Resend here or let frontend trigger via edge function, 
  -- but for now we return the OTP for testing purposes)
  RETURN json_build_object('success', true, 'otp', generated_otp);
END
$$;

GRANT EXECUTE ON FUNCTION public.request_university_verification(TEXT) TO authenticated;

-- 5) Create RPC to confirm the OTP
CREATE OR REPLACE FUNCTION public.confirm_university_verification(entered_email TEXT, entered_code TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  normalized TEXT := lower(trim(COALESCE(entered_email, '')));
  calling_user_id UUID := auth.uid();
  otp_record RECORD;
BEGIN
  -- Validate caller is authenticated
  IF calling_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  -- Find the OTP record
  SELECT * INTO otp_record
  FROM public.verification_otps
  WHERE user_id = calling_user_id 
    AND target_email = normalized 
    AND otp_code = entered_code;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Invalid or expired verification code.');
  END IF;

  -- Check expiration
  IF otp_record.expires_at < now() THEN
    DELETE FROM public.verification_otps WHERE id = otp_record.id;
    RETURN json_build_object('success', false, 'error', 'Verification code has expired. Please request a new one.');
  END IF;

  -- Verification successful! Update user roles
  UPDATE public.user_roles
  SET university_email = normalized,
      is_verified = TRUE
  WHERE user_id = calling_user_id;

  -- Clean up consumed OTP
  DELETE FROM public.verification_otps WHERE id = otp_record.id;

  RETURN json_build_object('success', true, 'message', 'University email successfully verified.');
END
$$;

GRANT EXECUTE ON FUNCTION public.confirm_university_verification(TEXT, TEXT) TO authenticated;
