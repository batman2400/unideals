-- ============================================================
-- UniDeals — Deal Auto-Launch Migration
-- ============================================================
-- Brands/partners create deals that go live immediately
-- (status = 'approved') without admin approval.
--
-- Events remain unchanged — they still require admin approval.
--
-- IMPORTANT: Run this ENTIRE file in the Supabase SQL Editor.
-- ============================================================

BEGIN;

-- ─── 0. Allow partners to insert deals as approved ──────────
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

-- ─── 1. Fix status-lock trigger ─────────────────────────────
-- Previous version blocked SQL Editor backfills because
-- get_user_role() returns 'student' when auth.uid() is NULL.
-- Only lock status changes for real authenticated non-admins.
CREATE OR REPLACE FUNCTION public.enforce_deal_status_moderation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Allow migrations / SQL Editor (no JWT session)
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

-- ─── 2. Approve existing pending deals (now actually works) ─
UPDATE public.deals
SET status = 'approved'
WHERE status = 'pending';

-- ─── 3. Recreate public listing RPC ─────────────────────────
CREATE OR REPLACE FUNCTION public.get_public_deals()
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
  created_at TIMESTAMPTZ
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
    d.created_at
  FROM public.deals d
  WHERE d.status = 'approved'
  ORDER BY d.created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_deals() TO anon, authenticated;

COMMIT;

-- ─── 4. Verify (run after commit; shows in Results) ─────────
SELECT status, COUNT(*) AS count
FROM public.deals
GROUP BY status
ORDER BY status;

SELECT COUNT(*) AS public_deal_count
FROM public.get_public_deals();
