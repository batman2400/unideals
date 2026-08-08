-- ============================================================
-- UniDeals — Fix admin Users brand column
-- ============================================================
-- After the brands table migration, partner_profiles stores
-- brand_id (and brand_name is often NULL). list_users_with_roles
-- still read only brand_name, so admin Users showed "—" even when
-- the partner was correctly assigned (e.g. Canela Ceylon).
--
-- Run this entire file in the Supabase SQL Editor.
-- ============================================================

BEGIN;

-- Keep denormalized brand_name in sync when promoting
CREATE OR REPLACE FUNCTION public.promote_user_to_partner(
  target_email TEXT,
  target_brand_id UUID
)
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

-- Backfill brand_name from brands for existing partner_profiles
UPDATE public.partner_profiles pp
SET brand_name = b.name,
    updated_at = NOW()
FROM public.brands b
WHERE pp.brand_id = b.id
  AND (pp.brand_name IS NULL OR pp.brand_name IS DISTINCT FROM b.name);

-- Admin user list: prefer brands.name, fall back to legacy brand_name
CREATE OR REPLACE FUNCTION public.list_users_with_roles(
  search_query TEXT DEFAULT '',
  role_filter TEXT DEFAULT NULL,
  page_limit INTEGER DEFAULT 50,
  page_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  user_id UUID,
  email TEXT,
  role TEXT,
  is_verified BOOLEAN,
  brand_name TEXT,
  created_at TIMESTAMPTZ,
  total_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  has_is_verified_column BOOLEAN := FALSE;
BEGIN
  IF public.get_user_role() <> 'admin' THEN
    RAISE EXCEPTION 'Only admins can list users.'
      USING ERRCODE = '42501';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'user_roles'
      AND column_name = 'is_verified'
  )
  INTO has_is_verified_column;

  IF has_is_verified_column THEN
    RETURN QUERY
    SELECT
      au.id AS user_id,
      au.email::TEXT AS email,
      COALESCE(ur.role::text, 'student') AS role,
      COALESCE(ur.is_verified, FALSE) AS is_verified,
      COALESCE(b.name, pp.brand_name)::TEXT AS brand_name,
      au.created_at AS created_at,
      COUNT(*) OVER() AS total_count
    FROM auth.users au
    LEFT JOIN public.user_roles ur ON ur.user_id = au.id
    LEFT JOIN public.partner_profiles pp ON pp.user_id = au.id
    LEFT JOIN public.brands b ON b.id = pp.brand_id
    WHERE (
      search_query = ''
      OR au.email ILIKE '%' || search_query || '%'
      OR COALESCE(b.name, pp.brand_name) ILIKE '%' || search_query || '%'
    )
    AND (
      role_filter IS NULL
      OR COALESCE(ur.role::text, 'student') = role_filter
    )
    ORDER BY au.created_at DESC
    LIMIT page_limit
    OFFSET page_offset;
  ELSE
    RETURN QUERY
    SELECT
      au.id AS user_id,
      au.email::TEXT AS email,
      COALESCE(ur.role::text, 'student') AS role,
      FALSE AS is_verified,
      COALESCE(b.name, pp.brand_name)::TEXT AS brand_name,
      au.created_at AS created_at,
      COUNT(*) OVER() AS total_count
    FROM auth.users au
    LEFT JOIN public.user_roles ur ON ur.user_id = au.id
    LEFT JOIN public.partner_profiles pp ON pp.user_id = au.id
    LEFT JOIN public.brands b ON b.id = pp.brand_id
    WHERE (
      search_query = ''
      OR au.email ILIKE '%' || search_query || '%'
      OR COALESCE(b.name, pp.brand_name) ILIKE '%' || search_query || '%'
    )
    AND (
      role_filter IS NULL
      OR COALESCE(ur.role::text, 'student') = role_filter
    )
    ORDER BY au.created_at DESC
    LIMIT page_limit
    OFFSET page_offset;
  END IF;
END
$$;

GRANT EXECUTE ON FUNCTION public.list_users_with_roles(TEXT, TEXT, INTEGER, INTEGER) TO authenticated;

COMMIT;

-- Verify: partners should show a brand when brand_id is set
SELECT
  au.email,
  pp.brand_id,
  pp.brand_name AS profile_brand_name,
  b.name AS brands_table_name
FROM public.partner_profiles pp
JOIN auth.users au ON au.id = pp.user_id
LEFT JOIN public.brands b ON b.id = pp.brand_id
ORDER BY au.email;
