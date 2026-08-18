-- P0: hide expired online promo codes and always return is_expired.
-- Apply AFTER supabase_coming_soon.sql and supabase_student_verification_admin_gate.sql.
-- Do not re-run v1/v2 verification SQL or supabase_security_hardening.sql after this.
--
-- Dashboard ops (not doable from git):
-- 1. Apply supabase_student_verification_admin_gate.sql if not already applied
-- 2. Apply this file
-- 3. Redeploy send-verification-otp, send-event-approved,
--    send-inquiry-notification, send-verification-rejected
-- 4. Allowlist /auth/callback for prod and localhost in Supabase Auth

-- ────────────────────────────────────────────────────────────
-- 1. Public listing: expose is_expired without leaking hidden end_time
-- ────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.get_public_deals();

CREATE FUNCTION public.get_public_deals()
RETURNS TABLE (
  id BIGINT,
  title TEXT,
  brand TEXT,
  discount TEXT,
  type TEXT,
  category TEXT,
  image_url TEXT,
  description TEXT,
  store_url TEXT,
  created_at TIMESTAMPTZ,
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  show_start_date BOOLEAN,
  show_end_date BOOLEAN,
  is_coming_soon BOOLEAN,
  is_expired BOOLEAN
)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    d.id,
    d.title,
    d.brand,
    d.discount,
    d.type,
    d.category,
    d.image_url,
    d.description,
    d.store_url,
    d.created_at,
    CASE
      WHEN d.start_time IS NOT NULL AND d.start_time > now() THEN d.start_time
      WHEN d.show_start_date THEN d.start_time
      ELSE NULL
    END AS start_time,
    CASE WHEN d.show_end_date THEN d.end_time ELSE NULL END AS end_time,
    d.show_start_date,
    d.show_end_date,
    (d.start_time IS NOT NULL AND d.start_time > now()) AS is_coming_soon,
    (d.end_time IS NOT NULL AND d.end_time < now()) AS is_expired
  FROM public.deals d
  WHERE d.status = 'approved'
  ORDER BY d.created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_deals() TO anon, authenticated;

-- ────────────────────────────────────────────────────────────
-- 2. Public deal by id: hide codes after end_time; return is_expired
-- ────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.get_public_deal_by_id(BIGINT);

CREATE FUNCTION public.get_public_deal_by_id(target_deal_id BIGINT)
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
  created_at TIMESTAMPTZ,
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  show_start_date BOOLEAN,
  show_end_date BOOLEAN,
  is_coming_soon BOOLEAN,
  is_expired BOOLEAN
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
  deal_is_coming_soon BOOLEAN := FALSE;
  deal_is_expired BOOLEAN := FALSE;
BEGIN
  SELECT
    (d.start_time IS NOT NULL AND d.start_time > now()),
    (d.end_time IS NOT NULL AND d.end_time < now())
  INTO deal_is_coming_soon, deal_is_expired
  FROM public.deals d
  WHERE d.id = target_deal_id
    AND d.status = 'approved'
  LIMIT 1;

  deal_is_coming_soon := COALESCE(deal_is_coming_soon, FALSE);
  deal_is_expired := COALESCE(deal_is_expired, FALSE);

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

  -- Coming soon or expired: never expose redemption codes to students
  IF (deal_is_coming_soon OR deal_is_expired)
     AND caller_role NOT IN ('admin', 'partner') THEN
    can_view_redemption_code := FALSE;
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
    d.created_at,
    CASE
      WHEN d.start_time IS NOT NULL AND d.start_time > now() THEN d.start_time
      WHEN d.show_start_date THEN d.start_time
      ELSE NULL
    END AS start_time,
    CASE WHEN d.show_end_date THEN d.end_time ELSE NULL END AS end_time,
    d.show_start_date,
    d.show_end_date,
    (d.start_time IS NOT NULL AND d.start_time > now()) AS is_coming_soon,
    (d.end_time IS NOT NULL AND d.end_time < now()) AS is_expired
  FROM public.deals d
  WHERE d.status = 'approved'
    AND d.id = target_deal_id
  LIMIT 1;
END
$$;

GRANT EXECUTE ON FUNCTION public.get_public_deal_by_id(BIGINT) TO anon, authenticated;

-- ────────────────────────────────────────────────────────────
-- 3. Allow paused on deals.status (enum in production, not a CHECK)
-- ────────────────────────────────────────────────────────────
ALTER TYPE public.deal_status ADD VALUE IF NOT EXISTS 'paused';

ALTER TABLE public.deals DROP CONSTRAINT IF EXISTS deals_status_check;

-- ────────────────────────────────────────────────────────────
-- 4. Partners may pause / unpause their own live deals
--    (approved <-> paused only). Admins still change any status.
--    Do not re-run supabase_security_hardening.sql after this.
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.enforce_deal_status_moderation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF public.get_user_role() = 'admin' THEN
    RETURN NEW;
  END IF;

  IF public.get_user_role() = 'partner'
     AND OLD.status::text IN ('approved', 'paused')
     AND NEW.status::text IN ('approved', 'paused')
     AND NEW.brand_id IS NOT NULL
     AND NEW.brand_id = public.get_partner_brand_id(auth.uid()) THEN
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    NEW.status := OLD.status;
  END IF;

  RETURN NEW;
END
$$;
