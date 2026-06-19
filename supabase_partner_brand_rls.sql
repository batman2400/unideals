-- Allow partners to update their own brand profile
DROP POLICY IF EXISTS "Partners can update own brand" ON public.brands;

CREATE POLICY "Partners can update own brand" ON public.brands
  FOR UPDATE TO authenticated
  USING (id = public.get_partner_brand_id(auth.uid()))
  WITH CHECK (id = public.get_partner_brand_id(auth.uid()));
