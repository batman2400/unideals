-- ============================================================
-- Fix: Phase 4 RLS bugs after migration to brand_id
-- ============================================================

-- 1. Create a helper function to get the partner's brand_id
CREATE OR REPLACE FUNCTION public.get_partner_brand_id(target_user_id UUID DEFAULT auth.uid())
RETURNS UUID
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT brand_id
  FROM public.partner_profiles
  WHERE user_id = target_user_id
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_partner_brand_id(UUID) TO anon, authenticated;

-- 2. Also fix the old get_partner_brand to return the actual brand name via join
-- so existing UI/functions don't break if they still rely on it.
CREATE OR REPLACE FUNCTION public.get_partner_brand(target_user_id UUID DEFAULT auth.uid())
RETURNS TEXT
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT b.name
  FROM public.partner_profiles pp
  LEFT JOIN public.brands b ON pp.brand_id = b.id
  WHERE pp.user_id = target_user_id
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_partner_brand(UUID) TO anon, authenticated;


-- 3. Replace all deals policies to use brand_id instead of string matching
-- and remove strict partner_id matching so multiple partners of the same brand
-- can collaboratively manage deals.

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

-- Partners can read only their own brand deals.
CREATE POLICY "Partners can read own brand deals"
  ON public.deals
  FOR SELECT
  USING (
    public.get_user_role() = 'partner'
    AND brand_id = public.get_partner_brand_id(auth.uid())
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
    AND partner_id = auth.uid()
    AND brand_id = public.get_partner_brand_id(auth.uid())
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
    AND brand_id = public.get_partner_brand_id(auth.uid())
  )
  WITH CHECK (
    public.get_user_role() = 'partner'
    AND brand_id = public.get_partner_brand_id(auth.uid())
  );

-- Partners can delete only their own brand deals.
CREATE POLICY "Partners can delete own brand deals"
  ON public.deals
  FOR DELETE
  USING (
    public.get_user_role() = 'partner'
    AND brand_id = public.get_partner_brand_id(auth.uid())
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

-- Update the guard to prevent partners from changing the deal's brand_id (they can't change brand or brand_id)
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

    -- They CAN reassign ownership to themselves or others in their brand?
    -- Actually, partner_id tracks who last modified or originally created. 
    -- Let's just prevent them from transferring it to someone outside the brand.
    -- Better yet, keep the rule: partners cannot reassign deal ownership.
    IF NEW.partner_id IS DISTINCT FROM OLD.partner_id THEN
      RAISE EXCEPTION 'Partners cannot reassign deal ownership.'
        USING ERRCODE = '42501';
    END IF;

    -- Prevent brand hopping
    IF NEW.brand_id IS DISTINCT FROM OLD.brand_id THEN
      RAISE EXCEPTION 'Partners cannot change deal brand.'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END
$$;

-- 4. Fix analytics to show stats for the brand, not just the user's personally created deals
CREATE OR REPLACE FUNCTION public.get_partner_deal_stats(target_partner_id UUID DEFAULT auth.uid())
RETURNS TABLE (
  deal_id BIGINT,
  deal_title TEXT,
  deal_type TEXT,
  deal_status TEXT,
  total_reveals BIGINT,
  total_copies BIGINT,
  total_click_throughs BIGINT,
  total_tickets_generated BIGINT,
  total_tickets_redeemed BIGINT,
  total_scans BIGINT,
  confirmed_redemptions BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_brand_id UUID;
BEGIN
  -- Only the partner themselves or an admin can call this
  IF auth.uid() <> target_partner_id AND public.get_user_role() <> 'admin' THEN
    RAISE EXCEPTION 'Access denied.'
      USING ERRCODE = '42501';
  END IF;

  target_brand_id := public.get_partner_brand_id(target_partner_id);

  RETURN QUERY
  SELECT
    d.id AS deal_id,
    d.title AS deal_title,
    d.type AS deal_type,
    d.status::text AS deal_status,
    COALESCE((SELECT COUNT(*) FROM public.online_code_events oce WHERE oce.deal_id = d.id AND oce.event_type = 'reveal'), 0)::BIGINT,
    COALESCE((SELECT COUNT(*) FROM public.online_code_events oce WHERE oce.deal_id = d.id AND oce.event_type = 'copy'), 0)::BIGINT,
    COALESCE((SELECT COUNT(*) FROM public.online_code_events oce WHERE oce.deal_id = d.id AND oce.event_type = 'click_through'), 0)::BIGINT,
    COALESCE((SELECT COUNT(*) FROM public.student_redemption_tickets srt WHERE srt.deal_id = d.id), 0)::BIGINT,
    COALESCE((SELECT COUNT(*) FROM public.student_redemption_tickets srt WHERE srt.deal_id = d.id AND srt.redeemed_at IS NOT NULL), 0)::BIGINT,
    COALESCE((SELECT COUNT(*) FROM public.redemption_events re WHERE re.deal_id = d.id), 0)::BIGINT,
    COALESCE((SELECT COUNT(*) FROM public.confirmed_redemptions cr WHERE cr.deal_id = d.id), 0)::BIGINT
  FROM public.deals d
  WHERE d.brand_id = target_brand_id
  ORDER BY d.created_at DESC;
END
$$;
