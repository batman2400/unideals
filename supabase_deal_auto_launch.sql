-- ============================================================
-- UniDeals — Deal Auto-Launch Migration
-- ============================================================
-- This migration allows brands/partners to create deals that
-- go live immediately (status = 'approved') without needing
-- admin approval.
--
-- Events remain unchanged — they still require admin approval.
--
-- Run this in the Supabase SQL Editor.
-- ============================================================

BEGIN;

-- ─── 1. Update the deal INSERT policy ───────────────────────
-- Allow partners to insert deals as 'approved' directly.
-- Previously this was restricted to 'pending' only.
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

-- ─── 2. Verify get_public_deals RPC is correct ─────────────
-- Re-create to ensure it returns all approved deals without
-- any time-based filtering that could cause deals to disappear.
-- Deals should remain visible regardless of start_time/end_time.
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
