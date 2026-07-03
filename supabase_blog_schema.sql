-- =============================================================
-- Lightweight Blog Engine Schema
-- =============================================================
-- This migration:
--   1. Creates the `posts` table for the blog.
--   2. Enables Row Level Security (RLS).
--   3. Adds policies for public SELECT and admin-only ALL.
-- =============================================================

CREATE TABLE IF NOT EXISTS public.posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    title TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    excerpt TEXT,
    content TEXT NOT NULL,
    cover_image_url TEXT,
    author_name TEXT DEFAULT 'Uni Deals Team',
    is_published BOOLEAN DEFAULT false
);

-- Enable RLS
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;

-- ─── Idempotent Policy Cleanup ──────────────────────────────
DROP POLICY IF EXISTS "Allow public to read published posts" ON public.posts;
DROP POLICY IF EXISTS "Allow admins full access to posts" ON public.posts;

-- ─── 1. SELECT Policy (Public/Anon) ─────────────────────────
-- Anyone can read posts that are published. Admins can read all posts (including drafts).
CREATE POLICY "Allow public to read published posts" 
ON public.posts
FOR SELECT 
USING (
    is_published = true 
    OR (
        auth.uid() IS NOT NULL 
        AND public.get_user_role() = 'admin'
    )
);

-- ─── 2. ALL Policy (Admins only) ─────────────────────────
-- Only admins can create, update, or delete posts.
CREATE POLICY "Allow admins full access to posts" 
ON public.posts
FOR ALL 
USING (
    auth.uid() IS NOT NULL 
    AND public.get_user_role() = 'admin'
)
WITH CHECK (
    auth.uid() IS NOT NULL 
    AND public.get_user_role() = 'admin'
);
