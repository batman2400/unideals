-- =============================================================
-- Inquiries (Contact & Partner) Pipeline Schema
-- =============================================================
-- This migration:
--   1. Creates the `inquiries` table for contact form submissions.
--   2. Enables Row Level Security (RLS).
--   3. Adds policies for public INSERT and admin-only SELECT/UPDATE.
-- =============================================================

CREATE TABLE IF NOT EXISTS public.inquiries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    inquiry_type TEXT DEFAULT 'general' CHECK (inquiry_type IN ('general', 'partner', 'event', 'support')),
    brand_name TEXT,
    message TEXT NOT NULL,
    status TEXT DEFAULT 'new' CHECK (status IN ('new', 'read', 'archived'))
);

-- Enable RLS
ALTER TABLE public.inquiries ENABLE ROW LEVEL SECURITY;

-- ─── Idempotent Policy Cleanup ──────────────────────────────
DROP POLICY IF EXISTS "Allow public to insert inquiries" ON public.inquiries;
DROP POLICY IF EXISTS "Allow admins to select inquiries" ON public.inquiries;
DROP POLICY IF EXISTS "Allow admins to update inquiries" ON public.inquiries;

-- ─── 1. INSERT Policy (Public/Anon) ─────────────────────────
-- Anyone (authenticated or not) can submit an inquiry via the contact form
CREATE POLICY "Allow public to insert inquiries" 
ON public.inquiries
FOR INSERT 
WITH CHECK (true);

-- ─── 2. SELECT Policy (Admins only) ─────────────────────────
-- Only admins can view the inquiries inbox
CREATE POLICY "Allow admins to select inquiries" 
ON public.inquiries
FOR SELECT 
USING (
    auth.uid() IS NOT NULL 
    AND public.get_user_role() = 'admin'
);

-- ─── 3. UPDATE Policy (Admins only) ─────────────────────────
-- Only admins can change the status of inquiries (e.g., mark as read/archived)
CREATE POLICY "Allow admins to update inquiries" 
ON public.inquiries
FOR UPDATE 
USING (
    auth.uid() IS NOT NULL 
    AND public.get_user_role() = 'admin'
)
WITH CHECK (
    auth.uid() IS NOT NULL 
    AND public.get_user_role() = 'admin'
);
