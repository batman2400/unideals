-- ============================================================
-- UniDeals — Stop sending student promo codes on deal load
--
-- DO NOT APPLY until:
--   1. supabase_reveal_deal_code.sql is live
--   2. Website Reveal uses reveal_online_deal_code
--   3. The store app that calls reveal_online_deal_code is shipped
--
-- Older app builds that still read redemption_code from
-- get_public_deal_by_id will show a blank online code after this.
-- Admins and owning partners still receive the code on deal load.
-- ============================================================

BEGIN;

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

  IF deal_is_expired AND COALESCE(caller_role, '') NOT IN ('admin', 'partner') THEN
    RETURN;
  END IF;

  -- Students never receive the code on page load. They must call
  -- reveal_online_deal_code. Admins and owning partners still can.
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
    can_view_redemption_code := FALSE;
  END IF;

  IF deal_is_coming_soon AND COALESCE(caller_role, '') NOT IN ('admin', 'partner') THEN
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

COMMIT;
