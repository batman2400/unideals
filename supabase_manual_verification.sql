-- ============================================================
-- UniDeals - Phase 8: Manual Verification Pipeline
-- ============================================================

-- 1) Create the manual_verifications table
CREATE TABLE IF NOT EXISTS public.manual_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  institution_type VARCHAR(50) NOT NULL CHECK (institution_type IN ('school', 'university')),
  institution_name TEXT NOT NULL,
  course_details TEXT,
  student_id_number TEXT,
  contact_email TEXT NOT NULL,
  proof_image_url TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Policies
ALTER TABLE public.manual_verifications ENABLE ROW LEVEL SECURITY;

-- Users can read their own verifications
CREATE POLICY "Users can view own manual verifications"
ON public.manual_verifications FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Admins can read all verifications
CREATE POLICY "Admins can view all manual verifications"
ON public.manual_verifications FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'
  )
);

-- Users can insert their own verifications (via RPC mostly, but good for safety)
CREATE POLICY "Users can insert own manual verifications"
ON public.manual_verifications FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- Admins can update all verifications
CREATE POLICY "Admins can update all manual verifications"
ON public.manual_verifications FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'
  )
);

-- 2) Setup Storage Bucket for verification-documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('verification-documents', 'verification-documents', true)
ON CONFLICT (id) DO NOTHING;

-- Storage Policies for verification-documents
CREATE POLICY "Allow authenticated users to upload verification documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'verification-documents');

CREATE POLICY "Allow public to read verification documents"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'verification-documents');

-- 3) RPC: submit_manual_verification
CREATE OR REPLACE FUNCTION public.submit_manual_verification(
  inst_type TEXT, 
  inst_name TEXT, 
  course TEXT, 
  student_id TEXT, 
  email TEXT, 
  image_url TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  calling_user_id UUID := auth.uid();
BEGIN
  -- Validate caller is authenticated
  IF calling_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  -- Check for existing pending request to prevent spam
  IF EXISTS (
    SELECT 1 FROM public.manual_verifications 
    WHERE user_id = calling_user_id AND status = 'pending'
  ) THEN
    RETURN json_build_object('success', false, 'error', 'You already have a pending verification request.');
  END IF;

  -- Insert the record
  INSERT INTO public.manual_verifications (
    user_id, institution_type, institution_name, course_details, 
    student_id_number, contact_email, proof_image_url
  ) VALUES (
    calling_user_id, inst_type, inst_name, course, student_id, email, image_url
  );

  RETURN json_build_object('success', true, 'message', 'Verification request submitted successfully.');
END
$$;

GRANT EXECUTE ON FUNCTION public.submit_manual_verification(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;

-- 4) RPC: approve_manual_verification
CREATE OR REPLACE FUNCTION public.approve_manual_verification(
  request_id UUID, 
  target_user_id UUID, 
  target_email TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  calling_user_id UUID := auth.uid();
  is_admin BOOLEAN;
BEGIN
  -- Validate caller is authenticated
  IF calling_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  -- Validate admin role
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_roles.user_id = calling_user_id AND user_roles.role = 'admin'
  ) INTO is_admin;

  IF NOT is_admin THEN
    RETURN json_build_object('success', false, 'error', 'Unauthorized. Admin access required.');
  END IF;

  -- Update the request status
  UPDATE public.manual_verifications
  SET status = 'approved', updated_at = NOW()
  WHERE id = request_id AND status = 'pending';

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Pending request not found.');
  END IF;

  -- Mark the user as verified in user_roles
  UPDATE public.user_roles
  SET is_verified = TRUE, university_email = target_email
  WHERE user_id = target_user_id;

  RETURN json_build_object('success', true, 'message', 'Request approved and user verified.');
END
$$;

GRANT EXECUTE ON FUNCTION public.approve_manual_verification(UUID, UUID, TEXT) TO authenticated;

-- 5) RPC: reject_manual_verification
CREATE OR REPLACE FUNCTION public.reject_manual_verification(request_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  calling_user_id UUID := auth.uid();
  is_admin BOOLEAN;
BEGIN
  -- Validate caller is authenticated
  IF calling_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  -- Validate admin role
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_roles.user_id = calling_user_id AND user_roles.role = 'admin'
  ) INTO is_admin;

  IF NOT is_admin THEN
    RETURN json_build_object('success', false, 'error', 'Unauthorized. Admin access required.');
  END IF;

  -- Update the request status
  UPDATE public.manual_verifications
  SET status = 'rejected', updated_at = NOW()
  WHERE id = request_id AND status = 'pending';

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Pending request not found.');
  END IF;

  RETURN json_build_object('success', true, 'message', 'Request rejected.');
END
$$;

GRANT EXECUTE ON FUNCTION public.reject_manual_verification(UUID) TO authenticated;
