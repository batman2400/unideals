-- Create storage bucket for event images
INSERT INTO storage.buckets (id, name, public) 
VALUES ('event-images', 'event-images', true) 
ON CONFLICT (id) DO NOTHING;

-- Bucket policies
CREATE POLICY "Event images publicly accessible" ON storage.objects
  FOR SELECT USING (bucket_id = 'event-images');

CREATE POLICY "Event images uploadable by admins and partners" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'event-images' AND public.get_user_role() IN ('admin', 'partner'));

CREATE POLICY "Event images updatable by admins and partners" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'event-images' AND public.get_user_role() IN ('admin', 'partner'));

CREATE POLICY "Event images deletable by admins and partners" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'event-images' AND public.get_user_role() IN ('admin', 'partner'));
