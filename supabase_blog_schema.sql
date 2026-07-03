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

-- =============================================================
-- Initial Seed Data
-- =============================================================
-- Insert 3 realistic, published blog posts for instant UI population
INSERT INTO public.posts (title, slug, excerpt, content, cover_image_url, author_name, is_published)
VALUES 
(
  'Top 5 Budget-Friendly Study Spots Around Colombo & Ratmalana',
  'top-5-budget-study-spots-colombo',
  'Need a quiet spot with reliable WiFi and cheap coffee to cram for your next assignment? We compiled the ultimate student-approved list.',
  'Finding a good place to study off-campus without spending your entire weekly allowance can be tough. Whether you need super-fast WiFi for coding projects, power outlets for your laptop, or just a quiet corner away from hostel noise, local cafes are your best friend.

### 1. What Makes a Great Study Cafe?
When scouting for the perfect study spot, you need three non-negotiables:
* **Reliable Power Outlets:** There is nothing worse than your battery hitting 10% right in the middle of a focused work block.
* **Affordable Menu:** A place where a black coffee or a short eat does not break the bank, so you can justify sitting there for a few hours.
* **Student-Friendly Vibe:** Staff that understands you are there to get work done, not just turn over a table in 15 minutes.

### The UniDeals Hack
Before you order that iced latte, always check your **UniDeals app**! Many local cafes around campus offer 10% to 15% off for verified students when you scan your QR code at the counter. Keep your eyes peeled on our Explore feed for new cafe partners dropping this week!',
  'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?auto=format&fit=crop&w=1200&q=80',
  'UniDeals Editorial Team',
  true
),
(
  'The Ultimate Student Guide: How to Maximize Your Discounts This Semester',
  'ultimate-student-guide-maximize-discounts',
  'From tech accessories and clothing to weekend dining, here is how to keep your wallet happy while living your best university life.',
  'Let us be honest—managing money as an undergrad is an art form. Between printing reports, buying hardware accessories, and trying to actually have a social life on the weekends, student budgets get stretched thin. 

### Why Stop at Student IDs?
For years, getting a student discount meant awkwardly waving your university ID card at a cashier and hoping the store manager approved it. **We built UniDeals to change that entirely.** 

By working directly with local brands, restaurants, and entertainment spots, we have digitalized the entire process. Here is how you can get the most out of the platform this semester:

1. **Check the Explore Feed Daily:** Our partner brands drop limited-time flash deals every week. If you see a deal you like, hit the save icon immediately!
2. **Use the QR Scanner:** No paper coupons required. Just open your Scanner tab, scan the partner brand’s counter code, and watch the discount apply instantly.
3. **Share With Your Batchmates:** Group dinners are way cheaper when everyone at the table knows which restaurants are currently running 20% student promos!',
  'https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&w=1200&q=80',
  'UniDeals Team',
  true
),
(
  'Balancing the Grind: Managing Exam Stress & Staying Active on a Budget',
  'balancing-the-grind-exam-stress-fitness',
  'It is easy to neglect your health when deadlines stack up. Here are three practical tips to keep your mind sharp and energy levels high.',
  'When project submissions and semester exams start piling up, physical health is usually the first thing students sacrifice. Late-night coding sessions fuel a diet of fast food and energy drinks, and gym routines get completely abandoned.

### The Science of Moving
You do not need a two-hour workout to reap the cognitive benefits of exercise. Studies show that even a 45-minute gym session or a brisk evening walk releases endorphins that significantly improve focus and memory retention during intense study blocks.

### 3 Tips for Busy Students
* **Schedule Your Workouts Like Lectures:** If it is not on your calendar, it will not happen. Treat your gym time or evening run as a mandatory class.
* **Prep Simple Meals:** Swap out daily delivery orders for high-protein, budget-friendly meal preps. Your brain (and your bank account) will thank you.
* **Look for Gym Discounts:** Staying fit should not cost a fortune. Check the **Sports & Fitness** category on UniDeals to find local gyms offering exclusive monthly membership rates for university students!',
  'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?auto=format&fit=crop&w=1200&q=80',
  'UniDeals Editorial Team',
  true
);
