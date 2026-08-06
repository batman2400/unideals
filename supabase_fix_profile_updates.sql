-- ============================================================
-- Fix: partner brand profile updates silently failing
--
-- Run this whole file in the Supabase SQL editor.
--
-- Three problems addressed:
--   1. brands.location was never created, so every brands UPDATE
--      sent from the profile page was rejected wholesale (PGRST204).
--   2. partner_profiles.brand_id may be NULL on older rows, which
--      makes the partner UPDATE policy match zero rows.
--   3. The UPDATE policy itself may never have been applied.
-- ============================================================

-- 1. The missing column (supabase_brands_location.sql was never run)
ALTER TABLE public.brands ADD COLUMN IF NOT EXISTS location TEXT;

-- 2. Backfill brand_id for any partner still linked only by brand_name.
--    get_partner_brand_id() reads this column, and the UPDATE policy
--    below compares against it, so a NULL here blocks all saves.
INSERT INTO public.brands (name)
SELECT DISTINCT brand_name
FROM public.partner_profiles
WHERE brand_name IS NOT NULL AND brand_id IS NULL
ON CONFLICT (name) DO NOTHING;

UPDATE public.partner_profiles pp
SET brand_id = b.id,
    updated_at = NOW()
FROM public.brands b
WHERE pp.brand_name = b.name AND pp.brand_id IS NULL;

-- 3. Re-assert the partner UPDATE policy (idempotent)
DROP POLICY IF EXISTS "Partners can update own brand" ON public.brands;

CREATE POLICY "Partners can update own brand" ON public.brands
  FOR UPDATE TO authenticated
  USING (id = public.get_partner_brand_id(auth.uid()))
  WITH CHECK (id = public.get_partner_brand_id(auth.uid()));

-- 4. Force PostgREST to pick up the new column immediately instead of
--    waiting for its schema cache to expire.
NOTIFY pgrst, 'reload schema';

-- ── Verification ────────────────────────────────────────────
-- Expect a row for 'location':
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'brands'
ORDER BY ordinal_position;

-- Expect zero rows (every partner should now resolve to a brand):
SELECT user_id, brand_name, brand_id
FROM public.partner_profiles
WHERE brand_id IS NULL;
