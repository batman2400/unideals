-- Fix RLS policy for partner deals to allow bypassing the moderation queue
-- Allows partners to insert deals with an 'approved' status instantly.

BEGIN;

DROP POLICY IF EXISTS "Partners can insert own brand deals" ON public.deals;

CREATE POLICY "Partners can insert own brand deals"
    ON public.deals
    FOR INSERT
    WITH CHECK (
      public.get_user_role() = 'partner'
      AND auth.uid() = partner_id
      AND lower(brand) = lower(public.get_partner_brand(auth.uid()))
      AND status IN ('pending', 'approved')
    );

COMMIT;
