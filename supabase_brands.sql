-- 1. Create brands table
CREATE TABLE IF NOT EXISTS public.brands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE CHECK (char_length(trim(name)) > 0),
  logo_url TEXT,
  description TEXT,
  website_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.brands ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read brands
CREATE POLICY "Brands readable by everyone" ON public.brands
  FOR SELECT USING (true);

-- Allow admins to insert/update/delete brands
CREATE POLICY "Brands modifiable by admins" ON public.brands
  FOR ALL TO authenticated
  USING (public.get_user_role() = 'admin')
  WITH CHECK (public.get_user_role() = 'admin');

-- Create storage bucket for brand logos
INSERT INTO storage.buckets (id, name, public) 
VALUES ('brand-logos', 'brand-logos', true) 
ON CONFLICT (id) DO NOTHING;

-- Bucket policies
CREATE POLICY "Brand logos publicly accessible" ON storage.objects
  FOR SELECT USING (bucket_id = 'brand-logos');

CREATE POLICY "Brand logos uploadable by admins" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'brand-logos' AND public.get_user_role() = 'admin');

CREATE POLICY "Brand logos updatable by admins" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'brand-logos' AND public.get_user_role() = 'admin');

CREATE POLICY "Brand logos deletable by admins" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'brand-logos' AND public.get_user_role() = 'admin');

-- 2. Modify partner_profiles
ALTER TABLE public.partner_profiles ADD COLUMN IF NOT EXISTS brand_id UUID REFERENCES public.brands(id) ON DELETE SET NULL;

-- Migrate existing partner profiles
INSERT INTO public.brands (name)
SELECT DISTINCT brand_name FROM public.partner_profiles WHERE brand_name IS NOT NULL
ON CONFLICT (name) DO NOTHING;

UPDATE public.partner_profiles pp
SET brand_id = b.id
FROM public.brands b
WHERE pp.brand_name = b.name AND pp.brand_id IS NULL;

-- Allow multiple partners per brand
DROP INDEX IF EXISTS partner_profiles_brand_name_unique_idx;

-- Make brand_name nullable so we can phase it out
ALTER TABLE public.partner_profiles ALTER COLUMN brand_name DROP NOT NULL;

-- 3. Modify deals
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS brand_id UUID REFERENCES public.brands(id) ON DELETE SET NULL;

UPDATE public.deals d
SET brand_id = b.id
FROM public.brands b
WHERE d.brand = b.name AND d.brand_id IS NULL;

-- Helper RPC for Admins to create a brand and assign it instantly if needed
-- Update the promote_user_to_partner function
DROP FUNCTION IF EXISTS public.promote_user_to_partner(TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.promote_user_to_partner(target_email TEXT, target_brand_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  normalized_email TEXT := lower(trim(target_email));
  target_user_id UUID;
  current_role TEXT;
  resolved_brand_name TEXT;
BEGIN
  IF public.get_user_role() <> 'admin' THEN
    RAISE EXCEPTION 'Only admins can promote users to partner.'
      USING ERRCODE = '42501';
  END IF;

  IF normalized_email IS NULL OR normalized_email = '' THEN
    RAISE EXCEPTION 'Email is required.'
      USING ERRCODE = '22023';
  END IF;

  IF target_brand_id IS NULL THEN
    RAISE EXCEPTION 'Brand ID is required.'
      USING ERRCODE = '22023';
  END IF;

  SELECT name
  INTO resolved_brand_name
  FROM public.brands
  WHERE id = target_brand_id;

  IF resolved_brand_name IS NULL THEN
    RAISE EXCEPTION 'Brand not found.'
      USING ERRCODE = 'P0002';
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

  INSERT INTO public.partner_profiles (user_id, brand_id, brand_name)
  VALUES (target_user_id, target_brand_id, resolved_brand_name)
  ON CONFLICT (user_id) DO UPDATE
    SET brand_id = EXCLUDED.brand_id,
        brand_name = EXCLUDED.brand_name,
        updated_at = NOW();

  RETURN target_user_id;
END
$$;

GRANT EXECUTE ON FUNCTION public.promote_user_to_partner(TEXT, UUID) TO authenticated;


