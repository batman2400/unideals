-- ============================================================
-- Uni Deals — Phase 4: Partner Brand Access Hardening
-- ============================================================
-- Run this AFTER supabase_schema.sql.
-- This script enforces that a partner can only create/delete/manage
-- deals for their assigned brand.
--
-- Partner onboarding can be done from Admin UI via promote_user_to_partner(email, brand).
-- Only initial admin bootstrap still needs one-time setup in user_roles:
--   INSERT INTO public.user_roles (user_id, role)
--   VALUES ('<admin-user-uuid>', 'admin')
--   ON CONFLICT (user_id) DO UPDATE SET role = 'admin';
-- ============================================================

-- Keep role lookup available for RLS checks.
CREATE TABLE IF NOT EXISTS public.user_roles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('student', 'partner', 'admin')),
  user_email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.user_roles
  ADD COLUMN IF NOT EXISTS user_email TEXT;

-- Ensure every authenticated user has a default role row.
INSERT INTO public.user_roles (user_id, role)
SELECT au.id, 'student'
FROM auth.users au
ON CONFLICT (user_id) DO NOTHING;

-- Keep user_email populated from auth.users for existing rows.
UPDATE public.user_roles ur
SET user_email = au.email
FROM auth.users au
WHERE au.id = ur.user_id
  AND ur.user_email IS DISTINCT FROM au.email;

-- Auto-populate email whenever role rows are inserted/updated.
CREATE OR REPLACE FUNCTION public.sync_user_role_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  SELECT email
  INTO NEW.user_email
  FROM auth.users
  WHERE id = NEW.user_id;

  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS trg_sync_user_role_email ON public.user_roles;
CREATE TRIGGER trg_sync_user_role_email
  BEFORE INSERT OR UPDATE OF user_id
  ON public.user_roles
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_user_role_email();

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own role" ON public.user_roles;
CREATE POLICY "Users can read own role"
  ON public.user_roles
  FOR SELECT
  USING (auth.uid() = user_id);

-- If an older get_user_role() exists with a non-text return type,
-- replace it safely to avoid 42P13 on CREATE OR REPLACE.
DO $$
DECLARE
  existing_result TEXT;
BEGIN
  SELECT pg_get_function_result(p.oid)
  INTO existing_result
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'get_user_role'
    AND pg_get_function_identity_arguments(p.oid) = ''
  LIMIT 1;

  IF existing_result IS NOT NULL AND lower(existing_result) <> 'text' THEN
    EXECUTE 'DROP FUNCTION public.get_user_role() CASCADE';
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT role::text
      FROM public.user_roles
      WHERE user_id = auth.uid()
      LIMIT 1
    ),
    'student'
  );
$$;

GRANT EXECUTE ON FUNCTION public.get_user_role() TO anon, authenticated;

-- One canonical brand per partner account.
CREATE TABLE IF NOT EXISTS public.partner_profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  brand_name TEXT NOT NULL CHECK (char_length(trim(brand_name)) > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS partner_profiles_brand_name_unique_idx
  ON public.partner_profiles (lower(brand_name));

ALTER TABLE public.partner_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Partner profiles readable by owner and admin" ON public.partner_profiles;
DROP POLICY IF EXISTS "Partner profiles insertable by admin" ON public.partner_profiles;
DROP POLICY IF EXISTS "Partner profiles updatable by admin" ON public.partner_profiles;
DROP POLICY IF EXISTS "Partner profiles insertable by owner and admin" ON public.partner_profiles;
DROP POLICY IF EXISTS "Partner profiles updatable by owner and admin" ON public.partner_profiles;
DROP POLICY IF EXISTS "Partner profiles deletable by admin" ON public.partner_profiles;

CREATE POLICY "Partner profiles readable by owner and admin"
  ON public.partner_profiles
  FOR SELECT
  USING (auth.uid() = user_id OR public.get_user_role() = 'admin');

CREATE POLICY "Partner profiles insertable by owner and admin"
  ON public.partner_profiles
  FOR INSERT
  WITH CHECK (
    public.get_user_role() = 'admin'
    OR (public.get_user_role() = 'partner' AND auth.uid() = user_id)
  );

CREATE POLICY "Partner profiles updatable by owner and admin"
  ON public.partner_profiles
  FOR UPDATE
  USING (
    public.get_user_role() = 'admin'
    OR (public.get_user_role() = 'partner' AND auth.uid() = user_id)
  )
  WITH CHECK (
    public.get_user_role() = 'admin'
    OR (public.get_user_role() = 'partner' AND auth.uid() = user_id)
  );

CREATE POLICY "Partner profiles deletable by admin"
  ON public.partner_profiles
  FOR DELETE
  USING (public.get_user_role() = 'admin');

-- Partners can set their own brand profile, but cannot rename brand
-- after they have already published offers under that profile.
CREATE OR REPLACE FUNCTION public.guard_partner_profile_updates()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.get_user_role() = 'partner'
     AND auth.uid() = OLD.user_id
     AND lower(COALESCE(NEW.brand_name, '')) IS DISTINCT FROM lower(COALESCE(OLD.brand_name, '')) THEN
    IF EXISTS (
      SELECT 1
      FROM public.deals d
      WHERE d.partner_id = auth.uid()
    ) THEN
      RAISE EXCEPTION 'Partners cannot rename brand after publishing offers.'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  NEW.updated_at = NOW();
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS trg_guard_partner_profile_updates ON public.partner_profiles;
CREATE TRIGGER trg_guard_partner_profile_updates
  BEFORE UPDATE ON public.partner_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_partner_profile_updates();

-- Same safety guard for environments where get_partner_brand(uuid)
-- exists but with a non-text return type.
DO $$
DECLARE
  existing_result TEXT;
BEGIN
  SELECT pg_get_function_result(p.oid)
  INTO existing_result
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'get_partner_brand'
    AND pg_get_function_identity_arguments(p.oid) = 'target_user_id uuid'
  LIMIT 1;

  IF existing_result IS NOT NULL AND lower(existing_result) <> 'text' THEN
    EXECUTE 'DROP FUNCTION public.get_partner_brand(uuid) CASCADE';
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION public.get_partner_brand(target_user_id UUID DEFAULT auth.uid())
RETURNS TEXT
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT brand_name
  FROM public.partner_profiles
  WHERE user_id = target_user_id
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_partner_brand(UUID) TO anon, authenticated;

-- Admin-only helper used by Admin UI to promote a user to partner by email
-- and assign/update the partner's canonical brand.
CREATE OR REPLACE FUNCTION public.promote_user_to_partner(target_email TEXT, target_brand TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  normalized_email TEXT := lower(trim(target_email));
  normalized_brand TEXT := trim(target_brand);
  target_user_id UUID;
  current_role TEXT;
BEGIN
  IF public.get_user_role() <> 'admin' THEN
    RAISE EXCEPTION 'Only admins can promote users to partner.'
      USING ERRCODE = '42501';
  END IF;

  IF normalized_email IS NULL OR normalized_email = '' THEN
    RAISE EXCEPTION 'Email is required.'
      USING ERRCODE = '22023';
  END IF;

  IF normalized_brand IS NULL OR normalized_brand = '' THEN
    RAISE EXCEPTION 'Brand name is required.'
      USING ERRCODE = '22023';
  END IF;

  SELECT id
  INTO target_user_id
  FROM auth.users
  WHERE lower(email) = normalized_email
  LIMIT 1;

  IF target_user_id IS NULL THEN
    RAISE EXCEPTION 'No user found for email: %', normalized_email
      USING ERRCODE = 'P0002';
  END IF;

  SELECT role
  INTO current_role
  FROM public.user_roles
  WHERE user_id = target_user_id;

  IF current_role = 'admin' THEN
    RAISE EXCEPTION 'Cannot change an admin user via partner promotion.'
      USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (target_user_id, 'partner')
  ON CONFLICT (user_id) DO UPDATE
    SET role = 'partner',
        user_email = (SELECT email FROM auth.users WHERE id = target_user_id);

  INSERT INTO public.partner_profiles (user_id, brand_name)
  VALUES (target_user_id, normalized_brand)
  ON CONFLICT (user_id) DO UPDATE
    SET brand_name = EXCLUDED.brand_name,
        updated_at = NOW();

  RETURN target_user_id;
END
$$;

GRANT EXECUTE ON FUNCTION public.promote_user_to_partner(TEXT, TEXT) TO authenticated;

-- Storage bucket and policies for direct deal image uploads.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'deal-images',
  'deal-images',
  TRUE,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Public can view deal images" ON storage.objects;
DROP POLICY IF EXISTS "Partners and admins can upload deal images" ON storage.objects;
DROP POLICY IF EXISTS "Partners and admins can update own deal images" ON storage.objects;
DROP POLICY IF EXISTS "Partners and admins can delete own deal images" ON storage.objects;

CREATE POLICY "Public can view deal images"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'deal-images');

CREATE POLICY "Partners and admins can upload deal images"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'deal-images'
    AND public.get_user_role() IN ('partner', 'admin')
    AND split_part(name, '/', 1) = 'partners'
    AND (
      public.get_user_role() = 'admin'
      OR split_part(name, '/', 2) = auth.uid()::text
    )
  );

CREATE POLICY "Partners and admins can update own deal images"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'deal-images'
    AND public.get_user_role() IN ('partner', 'admin')
    AND split_part(name, '/', 1) = 'partners'
    AND (
      public.get_user_role() = 'admin'
      OR split_part(name, '/', 2) = auth.uid()::text
    )
  )
  WITH CHECK (
    bucket_id = 'deal-images'
    AND public.get_user_role() IN ('partner', 'admin')
    AND split_part(name, '/', 1) = 'partners'
    AND (
      public.get_user_role() = 'admin'
      OR split_part(name, '/', 2) = auth.uid()::text
    )
  );

CREATE POLICY "Partners and admins can delete own deal images"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'deal-images'
    AND public.get_user_role() IN ('partner', 'admin')
    AND split_part(name, '/', 1) = 'partners'
    AND (
      public.get_user_role() = 'admin'
      OR split_part(name, '/', 2) = auth.uid()::text
    )
  );

-- Ensure deals table has moderation and ownership columns.
ALTER TABLE public.deals
  ADD COLUMN IF NOT EXISTS partner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.deals
  ADD COLUMN IF NOT EXISTS status TEXT;

UPDATE public.deals
SET status = 'approved'
WHERE status IS NULL;

ALTER TABLE public.deals
  ALTER COLUMN status SET DEFAULT 'approved';

ALTER TABLE public.deals
  ALTER COLUMN status SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'deals_status_check'
      AND conrelid = 'public.deals'::regclass
  ) THEN
    ALTER TABLE public.deals
      ADD CONSTRAINT deals_status_check
      CHECK (status IN ('pending', 'approved', 'rejected'));
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS deals_partner_id_idx ON public.deals (partner_id);
CREATE INDEX IF NOT EXISTS deals_status_idx ON public.deals (status);
CREATE INDEX IF NOT EXISTS deals_partner_brand_idx ON public.deals (partner_id, brand);

ALTER TABLE public.deals ENABLE ROW LEVEL SECURITY;

-- Partners may edit their own offers, but cannot alter moderation status,
-- ownership, or switch the deal to another brand.
CREATE OR REPLACE FUNCTION public.guard_partner_deal_updates()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.get_user_role() = 'partner' THEN
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      RAISE EXCEPTION 'Partners cannot change deal status.'
        USING ERRCODE = '42501';
    END IF;

    IF NEW.partner_id IS DISTINCT FROM OLD.partner_id THEN
      RAISE EXCEPTION 'Partners cannot reassign deal ownership.'
        USING ERRCODE = '42501';
    END IF;

    IF lower(COALESCE(NEW.brand, '')) IS DISTINCT FROM lower(COALESCE(OLD.brand, '')) THEN
      RAISE EXCEPTION 'Partners cannot change deal brand.'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS trg_guard_partner_deal_updates ON public.deals;
CREATE TRIGGER trg_guard_partner_deal_updates
  BEFORE UPDATE ON public.deals
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_partner_deal_updates();

-- Replace all existing deals policies to remove loopholes.
DO $$
DECLARE
  policy_record RECORD;
BEGIN
  FOR policy_record IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'deals'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.deals', policy_record.policyname);
  END LOOP;
END
$$;

-- Public reads only approved deals.
CREATE POLICY "Deals approved are publicly readable"
  ON public.deals
  FOR SELECT
  USING (status = 'approved');

-- Partners can read only their own brand deals.
CREATE POLICY "Partners can read own brand deals"
  ON public.deals
  FOR SELECT
  USING (
    public.get_user_role() = 'partner'
    AND auth.uid() = partner_id
    AND lower(brand) = lower(public.get_partner_brand(auth.uid()))
  );

-- Admins can read all deals.
CREATE POLICY "Admins can read all deals"
  ON public.deals
  FOR SELECT
  USING (public.get_user_role() = 'admin');

-- Partners can create only pending deals for their own brand.
CREATE POLICY "Partners can insert own brand deals"
  ON public.deals
  FOR INSERT
  WITH CHECK (
    public.get_user_role() = 'partner'
    AND auth.uid() = partner_id
    AND lower(brand) = lower(public.get_partner_brand(auth.uid()))
    AND status = 'pending'
  );

-- Admin insert support for operational flexibility.
CREATE POLICY "Admins can insert deals"
  ON public.deals
  FOR INSERT
  WITH CHECK (public.get_user_role() = 'admin');

-- Partners can edit non-moderation fields of their own brand deals.
CREATE POLICY "Partners can update own brand deals"
  ON public.deals
  FOR UPDATE
  USING (
    public.get_user_role() = 'partner'
    AND auth.uid() = partner_id
    AND lower(brand) = lower(public.get_partner_brand(auth.uid()))
  )
  WITH CHECK (
    public.get_user_role() = 'partner'
    AND auth.uid() = partner_id
    AND lower(brand) = lower(public.get_partner_brand(auth.uid()))
  );

-- Partners can delete only their own brand deals.
CREATE POLICY "Partners can delete own brand deals"
  ON public.deals
  FOR DELETE
  USING (
    public.get_user_role() = 'partner'
    AND auth.uid() = partner_id
    AND lower(brand) = lower(public.get_partner_brand(auth.uid()))
  );

-- Admins can delete any deal.
CREATE POLICY "Admins can delete deals"
  ON public.deals
  FOR DELETE
  USING (public.get_user_role() = 'admin');

-- Admins moderate deal status and other fields.
CREATE POLICY "Admins can update deals"
  ON public.deals
  FOR UPDATE
  USING (public.get_user_role() = 'admin')
  WITH CHECK (public.get_user_role() = 'admin');
