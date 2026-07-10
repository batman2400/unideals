-- ============================================================
-- Uni Deals — Test Accounts Setup
-- ============================================================
-- 
-- STEP 1: Create 3 accounts by signing up on your app or via
--         Supabase Dashboard → Authentication → Users → Add User
--
--   Email                        Password
--   ─────────────────────────    ──────────
--   admin@unideals.test          Test1234!
--   student@unideals.test        Test1234!
--   partner@unideals.test        Test1234!
--
-- STEP 2: After all 3 accounts exist in Supabase Auth,
--         run THIS script in Supabase SQL Editor.
--         It will assign the correct roles and set up
--         the partner's brand profile.
-- ============================================================

-- ── 1) Promote admin ────────────────────────────────────────
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'
FROM auth.users
WHERE lower(email) = 'admin@unideals.test'
ON CONFLICT (user_id) DO UPDATE
  SET role = 'admin';

-- Mark admin as verified
UPDATE public.user_roles
SET is_verified = TRUE
WHERE user_id = (SELECT id FROM auth.users WHERE lower(email) = 'admin@unideals.test');

-- ── 2) Ensure student has default role ──────────────────────
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'student'
FROM auth.users
WHERE lower(email) = 'student@unideals.test'
ON CONFLICT (user_id) DO UPDATE
  SET role = 'student';

-- Mark student as verified (so they can redeem deals)
UPDATE public.user_roles
SET is_verified = TRUE
WHERE user_id = (SELECT id FROM auth.users WHERE lower(email) = 'student@unideals.test');

-- ── 3) Promote partner + assign brand ───────────────────────
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'partner'
FROM auth.users
WHERE lower(email) = 'partner@unideals.test'
ON CONFLICT (user_id) DO UPDATE
  SET role = 'partner';

-- Mark partner as verified
UPDATE public.user_roles
SET is_verified = TRUE
WHERE user_id = (SELECT id FROM auth.users WHERE lower(email) = 'partner@unideals.test');

-- Create partner brand profile (assign them to "Brew & Co." as an example)
INSERT INTO public.partner_profiles (user_id, brand_name)
SELECT id, 'Brew & Co.'
FROM auth.users
WHERE lower(email) = 'partner@unideals.test'
ON CONFLICT (user_id) DO UPDATE
  SET brand_name = EXCLUDED.brand_name,
      updated_at = NOW();

-- ── Verify everything worked ────────────────────────────────
SELECT 
  ur.user_email,
  ur.role,
  ur.is_verified,
  pp.brand_name
FROM public.user_roles ur
LEFT JOIN public.partner_profiles pp ON pp.user_id = ur.user_id
WHERE ur.user_email IN ('admin@unideals.test', 'student@unideals.test', 'partner@unideals.test');
