-- Brand self-signup with admin approval.
-- Run this once in the Supabase SQL editor before the new app and website
-- screens will work. Existing brand rows stay public (status defaults to approved).
-- Admins can still create a brand from the brands screen; those rows are approved.
-- Students cannot set their own role or brand status.

ALTER TABLE public.brands
  ADD COLUMN IF NOT EXISTS status text,
  ADD COLUMN IF NOT EXISTS applicant_user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS contact_name text,
  ADD COLUMN IF NOT EXISTS contact_phone text,
  ADD COLUMN IF NOT EXISTS reviewed_by uuid,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS rejection_reason text,
  ADD COLUMN IF NOT EXISTS pending_name text,
  ADD COLUMN IF NOT EXISTS pending_logo_url text,
  ADD COLUMN IF NOT EXISTS profile_review_status text,
  ADD COLUMN IF NOT EXISTS profile_review_note text,
  ADD COLUMN IF NOT EXISTS submitted_at timestamptz;

UPDATE public.brands
SET status = 'approved'
WHERE status IS NULL;

UPDATE public.brands
SET profile_review_status = 'none'
WHERE profile_review_status IS NULL;

ALTER TABLE public.brands
  ALTER COLUMN status SET DEFAULT 'approved',
  ALTER COLUMN status SET NOT NULL,
  ALTER COLUMN profile_review_status SET DEFAULT 'none',
  ALTER COLUMN profile_review_status SET NOT NULL;

ALTER TABLE public.brands DROP CONSTRAINT IF EXISTS brands_status_check;
ALTER TABLE public.brands
  ADD CONSTRAINT brands_status_check
  CHECK (status IN ('pending', 'approved', 'rejected', 'suspended'));

ALTER TABLE public.brands DROP CONSTRAINT IF EXISTS brands_profile_review_status_check;
ALTER TABLE public.brands
  ADD CONSTRAINT brands_profile_review_status_check
  CHECK (profile_review_status IN ('none', 'pending', 'rejected'));

CREATE UNIQUE INDEX IF NOT EXISTS brands_applicant_user_id_key
  ON public.brands (applicant_user_id)
  WHERE applicant_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS brands_review_queue_idx
  ON public.brands (submitted_at DESC NULLS LAST)
  WHERE status = 'pending' OR profile_review_status = 'pending';

-- Pending applications are hidden from the public catalogue.
-- An applicant can still read their own row, and a partner can read their brand.
DROP POLICY IF EXISTS "Brands readable by everyone" ON public.brands;
DROP POLICY IF EXISTS "Brands visible when approved or owned" ON public.brands;

CREATE POLICY "Brands visible when approved or owned"
  ON public.brands
  FOR SELECT
  USING (
    status = 'approved'
    OR public.get_user_role() = 'admin'
    OR (auth.uid() IS NOT NULL AND applicant_user_id = auth.uid())
    OR (
      auth.uid() IS NOT NULL
      AND id = public.get_partner_brand_id(auth.uid())
    )
  );

-- Direct client updates cannot change review columns. A trusted RPC sets
-- app.brand_admin_write for the current transaction before it writes.
-- PostgREST cannot set that flag in the same request as a table update.
-- Approved partners may change the public name and logo immediately.
-- Re-apply this function on an existing project with
-- supabase_brand_name_logo_immediate.sql.
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

DROP TRIGGER IF EXISTS brand_guard_sensitive_update ON public.brands;
CREATE TRIGGER brand_guard_sensitive_update
  BEFORE UPDATE ON public.brands
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_brand_update();

CREATE OR REPLACE FUNCTION public.submit_brand_application(
  p_name text,
  p_contact_name text,
  p_contact_phone text,
  p_category text DEFAULT NULL,
  p_description text DEFAULT NULL,
  p_website_url text DEFAULT NULL,
  p_instagram_handle text DEFAULT NULL,
  p_tiktok_handle text DEFAULT NULL,
  p_location text DEFAULT NULL,
  p_logo_url text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  actor uuid := auth.uid();
  actor_role text;
  clean_name text := btrim(coalesce(p_name, ''));
  clean_contact text := btrim(coalesce(p_contact_name, ''));
  clean_phone text := btrim(coalesce(p_contact_phone, ''));
  clean_website text := NULLIF(btrim(coalesce(p_website_url, '')), '');
  clean_instagram text := NULLIF(ltrim(btrim(coalesce(p_instagram_handle, '')), '@'), '');
  clean_tiktok text := NULLIF(ltrim(btrim(coalesce(p_tiktok_handle, '')), '@'), '');
  clean_category text := NULLIF(btrim(coalesce(p_category, '')), '');
  clean_description text := NULLIF(btrim(coalesce(p_description, '')), '');
  clean_location text := NULLIF(btrim(coalesce(p_location, '')), '');
  clean_logo text := NULLIF(btrim(coalesce(p_logo_url, '')), '');
  existing public.brands%ROWTYPE;
  result_id uuid;
BEGIN
  IF actor IS NULL THEN
    RAISE EXCEPTION 'Sign in to apply.'
      USING ERRCODE = '42501';
  END IF;

  actor_role := public.get_user_role();
  IF actor_role IN ('partner', 'admin') THEN
    RAISE EXCEPTION 'Partner and admin accounts cannot submit a brand application.'
      USING ERRCODE = '42501';
  END IF;

  IF clean_name = '' OR char_length(clean_name) > 80 THEN
    RAISE EXCEPTION 'Enter a brand name of 80 characters or fewer.'
      USING ERRCODE = '22023';
  END IF;

  IF clean_contact = '' OR char_length(clean_contact) > 80 THEN
    RAISE EXCEPTION 'Enter a contact name.'
      USING ERRCODE = '22023';
  END IF;

  IF char_length(clean_phone) < 7 OR char_length(clean_phone) > 30 THEN
    RAISE EXCEPTION 'Enter a contact phone number.'
      USING ERRCODE = '22023';
  END IF;

  IF clean_website IS NULL AND clean_instagram IS NULL AND clean_tiktok IS NULL THEN
    RAISE EXCEPTION 'Add a website or a social link so we can confirm the brand.'
      USING ERRCODE = '22023';
  END IF;

  IF clean_website IS NOT NULL AND clean_website !~* '^https?://' THEN
    RAISE EXCEPTION 'Website must start with http:// or https://.'
      USING ERRCODE = '22023';
  END IF;

  IF clean_logo IS NOT NULL AND clean_logo !~* '^https?://' THEN
    RAISE EXCEPTION 'Logo must be an uploaded image.'
      USING ERRCODE = '22023';
  END IF;

  IF clean_category IS NOT NULL AND char_length(clean_category) > 80 THEN
    RAISE EXCEPTION 'Category is too long.'
      USING ERRCODE = '22023';
  END IF;

  IF clean_description IS NOT NULL AND char_length(clean_description) > 1000 THEN
    RAISE EXCEPTION 'Description is too long.'
      USING ERRCODE = '22023';
  END IF;

  IF clean_location IS NOT NULL AND char_length(clean_location) > 120 THEN
    RAISE EXCEPTION 'Location is too long.'
      USING ERRCODE = '22023';
  END IF;

  SELECT *
  INTO existing
  FROM public.brands
  WHERE applicant_user_id = actor
  FOR UPDATE;

  IF FOUND THEN
    IF existing.status = 'approved' THEN
      RAISE EXCEPTION 'Your brand is already approved.'
        USING ERRCODE = '22023';
    END IF;

    IF existing.status = 'suspended' THEN
      RAISE EXCEPTION 'This brand is suspended. Contact support.'
        USING ERRCODE = '22023';
    END IF;

    IF existing.submitted_at IS NOT NULL
       AND existing.submitted_at > now() - interval '1 minute' THEN
      RAISE EXCEPTION 'Please wait a minute before submitting again.'
        USING ERRCODE = '22023';
    END IF;

    PERFORM set_config('app.brand_admin_write', '1', true);

    UPDATE public.brands
    SET
      name = clean_name,
      category = clean_category,
      description = clean_description,
      website_url = clean_website,
      instagram_handle = clean_instagram,
      tiktok_handle = clean_tiktok,
      location = clean_location,
      logo_url = clean_logo,
      contact_name = clean_contact,
      contact_phone = clean_phone,
      status = 'pending',
      rejection_reason = NULL,
      reviewed_by = NULL,
      reviewed_at = NULL,
      submitted_at = now(),
      updated_at = now()
    WHERE id = existing.id
    RETURNING id INTO result_id;

    RETURN result_id;
  END IF;

  INSERT INTO public.brands (
    name,
    category,
    description,
    website_url,
    instagram_handle,
    tiktok_handle,
    location,
    logo_url,
    contact_name,
    contact_phone,
    status,
    applicant_user_id,
    submitted_at
  )
  VALUES (
    clean_name,
    clean_category,
    clean_description,
    clean_website,
    clean_instagram,
    clean_tiktok,
    clean_location,
    clean_logo,
    clean_contact,
    clean_phone,
    'pending',
    actor,
    now()
  )
  RETURNING id INTO result_id;

  RETURN result_id;
EXCEPTION
  WHEN unique_violation THEN
    IF SQLERRM ILIKE '%brands_applicant_user_id_key%' THEN
      RAISE EXCEPTION 'You already have a brand application.'
        USING ERRCODE = '23505';
    END IF;
    RAISE EXCEPTION 'That brand name is already taken. Please choose another.'
      USING ERRCODE = '23505';
END;
$$;

CREATE OR REPLACE FUNCTION public.approve_brand_application(p_brand_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  brand public.brands%ROWTYPE;
  applicant_email text;
  current_role text;
BEGIN
  IF public.get_user_role() <> 'admin' THEN
    RAISE EXCEPTION 'Only admins can review brand applications.'
      USING ERRCODE = '42501';
  END IF;

  SELECT *
  INTO brand
  FROM public.brands
  WHERE id = p_brand_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Application not found.'
      USING ERRCODE = 'P0002';
  END IF;

  IF brand.status <> 'pending' THEN
    RAISE EXCEPTION 'This application is not pending.'
      USING ERRCODE = '22023';
  END IF;

  IF brand.applicant_user_id IS NULL THEN
    RAISE EXCEPTION 'This brand has no applicant to promote.'
      USING ERRCODE = '22023';
  END IF;

  SELECT email
  INTO applicant_email
  FROM auth.users
  WHERE id = brand.applicant_user_id;

  IF applicant_email IS NULL OR btrim(applicant_email) = '' THEN
    RAISE EXCEPTION 'Applicant account not found.'
      USING ERRCODE = 'P0002';
  END IF;

  SELECT role
  INTO current_role
  FROM public.user_roles
  WHERE user_id = brand.applicant_user_id;

  IF current_role = 'admin' THEN
    RAISE EXCEPTION 'Cannot promote an admin account.'
      USING ERRCODE = '22023';
  END IF;

  IF current_role = 'partner' THEN
    RAISE EXCEPTION 'This user is already a partner.'
      USING ERRCODE = '22023';
  END IF;

  PERFORM set_config('app.brand_admin_write', '1', true);

  UPDATE public.brands
  SET
    status = 'approved',
    rejection_reason = NULL,
    reviewed_by = auth.uid(),
    reviewed_at = now(),
    updated_at = now()
  WHERE id = brand.id;

  PERFORM public.promote_user_to_partner(applicant_email, brand.id);
END;
$$;

CREATE OR REPLACE FUNCTION public.reject_brand_application(
  p_brand_id uuid,
  p_reason text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  brand public.brands%ROWTYPE;
BEGIN
  IF public.get_user_role() <> 'admin' THEN
    RAISE EXCEPTION 'Only admins can review brand applications.'
      USING ERRCODE = '42501';
  END IF;

  SELECT *
  INTO brand
  FROM public.brands
  WHERE id = p_brand_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Application not found.'
      USING ERRCODE = 'P0002';
  END IF;

  IF brand.status <> 'pending' THEN
    RAISE EXCEPTION 'This application is not pending.'
      USING ERRCODE = '22023';
  END IF;

  PERFORM set_config('app.brand_admin_write', '1', true);

  UPDATE public.brands
  SET
    status = 'rejected',
    rejection_reason = NULLIF(btrim(coalesce(p_reason, '')), ''),
    reviewed_by = auth.uid(),
    reviewed_at = now(),
    updated_at = now()
  WHERE id = brand.id;
END;
$$;

CREATE OR REPLACE FUNCTION public.approve_brand_profile_change(p_brand_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  brand public.brands%ROWTYPE;
  next_name text;
BEGIN
  IF public.get_user_role() <> 'admin' THEN
    RAISE EXCEPTION 'Only admins can review brand profile changes.'
      USING ERRCODE = '42501';
  END IF;

  SELECT *
  INTO brand
  FROM public.brands
  WHERE id = p_brand_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Brand not found.'
      USING ERRCODE = 'P0002';
  END IF;

  IF brand.profile_review_status <> 'pending' THEN
    RAISE EXCEPTION 'This brand has no profile change waiting for review.'
      USING ERRCODE = '22023';
  END IF;

  next_name := NULLIF(btrim(coalesce(brand.pending_name, '')), '');

  PERFORM set_config('app.brand_admin_write', '1', true);

  UPDATE public.brands
  SET
    name = COALESCE(next_name, name),
    logo_url = CASE
      WHEN pending_logo_url IS NULL THEN logo_url
      ELSE pending_logo_url
    END,
    pending_name = NULL,
    pending_logo_url = NULL,
    profile_review_status = 'none',
    profile_review_note = NULL,
    updated_at = now()
  WHERE id = brand.id;
END;
$$;

CREATE OR REPLACE FUNCTION public.reject_brand_profile_change(
  p_brand_id uuid,
  p_reason text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  brand public.brands%ROWTYPE;
BEGIN
  IF public.get_user_role() <> 'admin' THEN
    RAISE EXCEPTION 'Only admins can review brand profile changes.'
      USING ERRCODE = '42501';
  END IF;

  SELECT *
  INTO brand
  FROM public.brands
  WHERE id = p_brand_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Brand not found.'
      USING ERRCODE = 'P0002';
  END IF;

  IF brand.profile_review_status <> 'pending' THEN
    RAISE EXCEPTION 'This brand has no profile change waiting for review.'
      USING ERRCODE = '22023';
  END IF;

  PERFORM set_config('app.brand_admin_write', '1', true);

  UPDATE public.brands
  SET
    pending_name = NULL,
    pending_logo_url = NULL,
    profile_review_status = 'rejected',
    profile_review_note = NULLIF(btrim(coalesce(p_reason, '')), ''),
    updated_at = now()
  WHERE id = brand.id;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_brand_application(text, text, text, text, text, text, text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_brand_application(text, text, text, text, text, text, text, text, text, text) TO authenticated;

REVOKE ALL ON FUNCTION public.approve_brand_application(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_brand_application(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.reject_brand_application(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reject_brand_application(uuid, text) TO authenticated;

REVOKE ALL ON FUNCTION public.approve_brand_profile_change(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_brand_profile_change(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.reject_brand_profile_change(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reject_brand_profile_change(uuid, text) TO authenticated;

-- Applicants upload a logo before they are partners. The path is
-- applications/{their user id}/... so they cannot overwrite another brand.
DROP POLICY IF EXISTS "Applicants can upload application logos" ON storage.objects;
CREATE POLICY "Applicants can upload application logos"
  ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'brand-logos'
    AND (storage.foldername(name))[1] = 'applications'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );

NOTIFY pgrst, 'reload schema';
