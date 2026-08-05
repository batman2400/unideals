-- 1. Create the user_roles table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.user_roles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('student', 'partner', 'admin')),
  user_email TEXT,
  university_email TEXT,
  is_verified BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ensure every authenticated user has a default role row.
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'student'
FROM auth.users
ON CONFLICT (user_id) DO NOTHING;

-- Enable Row Level Security on the table
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 2. Create the get_user_role() function (required by RLS policies)
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT role::text
      FROM public.user_roles
      WHERE user_id = auth.uid()
      LIMIT 1
    ),
    'student'
  );
$$;

GRANT EXECUTE ON FUNCTION public.get_user_role() TO anon, authenticated;

-- 3. Apply the Admin Access RLS Policies

BEGIN;

-- Existing basic policy so users can read their own role (needed for the frontend Context)
DROP POLICY IF EXISTS "Users can read own role" ON public.user_roles;
CREATE POLICY "Users can read own role"
  ON public.user_roles
  FOR SELECT
  USING (auth.uid() = user_id);

-- Admins can read all user roles
DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
CREATE POLICY "Admins can view all roles"
  ON public.user_roles
  FOR SELECT
  USING (public.get_user_role() = 'admin');

-- Admins can insert roles (e.g., granting admin or partner to a new user)
DROP POLICY IF EXISTS "Admins can insert roles" ON public.user_roles;
CREATE POLICY "Admins can insert roles"
  ON public.user_roles
  FOR INSERT
  WITH CHECK (public.get_user_role() = 'admin');

-- Admins can update roles (e.g., promoting a student/partner to admin)
DROP POLICY IF EXISTS "Admins can update roles" ON public.user_roles;
CREATE POLICY "Admins can update roles"
  ON public.user_roles
  FOR UPDATE
  USING (public.get_user_role() = 'admin')
  WITH CHECK (public.get_user_role() = 'admin');

-- Admins can delete roles (e.g., demoting someone completely)
DROP POLICY IF EXISTS "Admins can delete roles" ON public.user_roles;
CREATE POLICY "Admins can delete roles"
  ON public.user_roles
  FOR DELETE
  USING (public.get_user_role() = 'admin');

COMMIT;
