-- ============================================================
-- Uni Deals — Test Accounts Setup & Email Confirmation
-- ============================================================
-- The auth accounts (admin@unideals.test, student@unideals.test, partner@unideals.test)
-- have already been created in Supabase Auth with password: Test1234!
--
-- Run this script in the Supabase SQL Editor to:
--   1) Instantly confirm their emails (bypassing email verification)
--   2) Assign roles (admin, student, partner) & verify them
--   3) Link the partner account to a brand ("Brew & Co.")
-- ============================================================

-- ── 1) Auto-confirm emails in auth.users ─────────────────────
UPDATE auth.users
SET email_confirmed_at = COALESCE(email_confirmed_at, NOW())
WHERE lower(email) IN (
  'admin@unideals.test',
  'student@unideals.test',
  'partner@unideals.test'
);

-- ── 2) Promote Admin ─────────────────────────────────────────
INSERT INTO public.user_roles (user_id, role, user_email, is_verified)
SELECT id, 'admin', lower(email), TRUE
FROM auth.users
WHERE lower(email) = 'admin@unideals.test'
ON CONFLICT (user_id) DO UPDATE
  SET role = 'admin',
      user_email = EXCLUDED.user_email,
      is_verified = TRUE;

-- ── 3) Ensure Student is Verified ────────────────────────────
INSERT INTO public.user_roles (user_id, role, user_email, is_verified)
SELECT id, 'student', lower(email), TRUE
FROM auth.users
WHERE lower(email) = 'student@unideals.test'
ON CONFLICT (user_id) DO UPDATE
  SET role = 'student',
      user_email = EXCLUDED.user_email,
      is_verified = TRUE;

-- ── 4) Promote Partner + Assign Brand ────────────────────────
INSERT INTO public.user_roles (user_id, role, user_email, is_verified)
SELECT id, 'partner', lower(email), TRUE
FROM auth.users
WHERE lower(email) = 'partner@unideals.test'
ON CONFLICT (user_id) DO UPDATE
  SET role = 'partner',
      user_email = EXCLUDED.user_email,
      is_verified = TRUE;

-- Create or update partner brand profile (assigned to "Brew & Co.")
INSERT INTO public.partner_profiles (user_id, brand_name)
SELECT id, 'Brew & Co.'
FROM auth.users
WHERE lower(email) = 'partner@unideals.test'
ON CONFLICT (user_id) DO UPDATE
  SET brand_name = EXCLUDED.brand_name,
      updated_at = NOW();

-- (Optional) If you also want your currently logged-in account (brucewayne110322@gmail.com) 
-- to have admin access, uncomment the lines below:
-- INSERT INTO public.user_roles (user_id, role, user_email, is_verified)
-- SELECT id, 'admin', lower(email), TRUE
-- FROM auth.users
-- WHERE lower(email) = 'brucewayne110322@gmail.com'
-- ON CONFLICT (user_id) DO UPDATE
--   SET role = 'admin',
--       user_email = EXCLUDED.user_email,
--       is_verified = TRUE;

-- ── 5) Verify Everything ─────────────────────────────────────
SELECT 
  u.email,
  u.email_confirmed_at IS NOT NULL AS email_confirmed,
  ur.role,
  ur.is_verified,
  pp.brand_name
FROM auth.users u
LEFT JOIN public.user_roles ur ON ur.user_id = u.id
LEFT JOIN public.partner_profiles pp ON pp.user_id = u.id
WHERE lower(u.email) IN ('admin@unideals.test', 'student@unideals.test', 'partner@unideals.test')
ORDER BY ur.role;

