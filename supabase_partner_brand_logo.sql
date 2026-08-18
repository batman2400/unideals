-- ============================================================
-- Allow partners to upload / replace their own brand logo.
-- Admins keep full access. Run in the Supabase SQL editor.
-- ============================================================

DROP POLICY IF EXISTS "Brand logos uploadable by admins" ON storage.objects;
DROP POLICY IF EXISTS "Brand logos updatable by admins" ON storage.objects;
DROP POLICY IF EXISTS "Brand logos deletable by admins" ON storage.objects;
DROP POLICY IF EXISTS "Brand logos uploadable by brand owners" ON storage.objects;
DROP POLICY IF EXISTS "Brand logos updatable by brand owners" ON storage.objects;
DROP POLICY IF EXISTS "Brand logos deletable by brand owners" ON storage.objects;

CREATE POLICY "Brand logos uploadable by brand owners"
  ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'brand-logos'
    AND (
      public.get_user_role() = 'admin'
      OR public.get_partner_brand_id(auth.uid()) IS NOT NULL
    )
  );

CREATE POLICY "Brand logos updatable by brand owners"
  ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'brand-logos'
    AND (
      public.get_user_role() = 'admin'
      OR public.get_partner_brand_id(auth.uid()) IS NOT NULL
    )
  );

CREATE POLICY "Brand logos deletable by brand owners"
  ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'brand-logos'
    AND (
      public.get_user_role() = 'admin'
      OR public.get_partner_brand_id(auth.uid()) IS NOT NULL
    )
  );
