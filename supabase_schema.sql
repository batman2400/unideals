-- ============================================================
-- Uni Deals — Database Schema & Seed Data
-- ============================================================
-- Run this ONCE in your Supabase Dashboard:
--   1. Go to https://supabase.com/dashboard → your project
--   2. Click "SQL Editor" in the left sidebar
--   3. Click "+ New Query"
--   4. Paste this entire script
--   5. Click "Run" (Ctrl+Enter / Cmd+Enter)
-- ============================================================

-- Drop table if it already exists (for clean re-runs)
DROP TABLE IF EXISTS deals;

-- Create the deals table
CREATE TABLE deals (
  id              BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  title           TEXT NOT NULL,
  brand           TEXT NOT NULL,
  discount        TEXT NOT NULL,
  type            TEXT NOT NULL CHECK (type IN ('Online', 'In-Store')),
  category        TEXT NOT NULL,
  image_url       TEXT NOT NULL,
  description     TEXT NOT NULL,
  redemption_code TEXT NOT NULL,
  store_url       TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security (read-only public access)
ALTER TABLE deals ENABLE ROW LEVEL SECURITY;

-- Allow anyone (anon key) to read deals
CREATE POLICY "Deals are publicly readable"
  ON deals
  FOR SELECT
  USING (true);

-- ============================================================
-- Seed data (matches mockData.js exactly)
-- ============================================================

INSERT INTO deals (title, brand, discount, type, category, image_url, description, redemption_code, store_url)
VALUES
  (
    'TechNova Pro',
    'TechNova',
    '20% OFF',
    'Online',
    'Tech',
    'https://lh3.googleusercontent.com/aida-public/AB6AXuCdG-2Jqc1sFEzIzRESXx8K8BItiMhQ7Fe3m2AwiW40ScLzJS5LQ56bEj7jshQCDva9eMVA3JrRls31IJeWBNFPDgcG34uqhvhI22s9ESRnEM9Sj4PrzhV6bT4iYZ_fNn89yaKc9JQ7vEujYUUEPKsmArVBU2fOiY7723xXXQqv1mafUPMNq6AEmiayO1B7SUoBrZ36-V_W_E9mrI_8zAN37_jT-EjpmU0mpdudzYqAiGr_HJIpgtCCHHK492hiHpyw442eXsFueEc',
    'Save on the latest generation of flagship devices and professional creative software.',
    'TECHNOVA20',
    'https://technova.example.com/student-deals'
  ),
  (
    'Brew & Co.',
    'Brew & Co.',
    '15% OFF',
    'In-Store',
    'Coffee',
    'https://lh3.googleusercontent.com/aida-public/AB6AXuDvOrc_ZGFRba9R0_nKoRINZ5tRxNmW-4lIEr_V0GN6gXTnSu7DWgW5rQ4_n0v7d2cmf-H5R-SgaRn5RmvjhFlwbLM5UaZiogKwcUmnk3G4V6a27DcVlGWQMnbwd1mKvUY-y6DAVR9gpxHs9OYCv1EgUKpslQDiRzFMn1Ou0XmJN5NL88ScH4IYQmD-qmZzIgsGr-8rFCDl-9fqQMueV77q82InBqAHqrDWYRIdNQShFMx54sbJnELdQf2gvbkpzZ0HES91UohXj2A',
    'Daily caffeine essentials with exclusive membership pricing at all urban locations.',
    'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    NULL
  ),
  (
    'Essence Wear',
    'Essence Wear',
    '25% OFF',
    'Online',
    'Clothing',
    'https://lh3.googleusercontent.com/aida-public/AB6AXuCzOvLNPgk03USFCKNu-GSzr9_dG9Cm3IPn04us2RsA5WNrpv7kXluz1pKVGDoWg25RiLBQB1fB29I5ZtSSxP-VRZO9pTj4_i7YzmJQGsB5rWtNPQYfBMSpYn8ecO1qkcOImTsFwhBvI9d_zwBCanWoMsWcoGglkPVREOwhsLl4333y_W6F-aBfjPfU0jhgJf8o-43sazueipq-nYtKuUCo56Hh3oQ1uWZJ6v_XJep8TPKq9lSRlBs9a7UD7DDWezf0kbdke4zHLvA',
    'Elevate your campus style with sustainable basics and premium seasonal collections.',
    'ESSENCE25',
    'https://essencewear.example.com/students'
  ),
  (
    'Nexus Fitness',
    'Nexus Fitness',
    'FREE MONTH',
    'In-Store',
    'Fitness',
    'https://lh3.googleusercontent.com/aida-public/AB6AXuBlQ36ohtoAh9iCNqXOhzdY_i9C66nAuwPjEoY7ATPU7F6ORrkJ9RNozLPw-UlMH_AQ6347sUVdnofSpsAPDPcEDTbHI8kJ-sDd4U4-FL7KtVn0Vid0AKYeDKMnI3_zrZVee7dE003pYw1DkC4gX1Zu8gPPZpyP8zuwQXr8nMXfnT_uQQ8dElkjTXuO7k0Qc_YLrFAX7Ad1UFcbhm5fe5ZOEXLXSjyn2WLYkVCVBMx6LLOVrjorS4brUS3XyKYwP0blJjuevpgSx-Q',
    'Achieve your peak performance with all-access passes to state-of-the-art facilities.',
    'b2c3d4e5-f6a7-8901-bcde-f12345678901',
    NULL
  ),
  (
    'Habitat Home',
    'Habitat Home',
    '10% OFF',
    'Online',
    'Home',
    'https://lh3.googleusercontent.com/aida-public/AB6AXuAZJkcufRYEZVBJQHpPPMMFRRa666JoWSP--59sPJn-M8ZQeeSSxdKIwlVoClxOXzXBkbWLnBjnSTeu3ZbVd9bwUZrllroLwKliU1H0NZAdsUaTJRWnKE0OtKjq0C6PLsuEeBBaxYg1twgDiskLcyPcjOZjP3IRopDylKF6eRD0uLoKbXdzTR630xOd9-btXTE0Odtm79tP7Gb7goFCqRbK7VMJG-8OxL_V4-SNH5DS_OliUk6NEnRVxzgpXA350ggKALFQL5WQOkg',
    'Modernize your living space with curated furniture and functional decor designed for students.',
    'HABITAT10',
    'https://habitathome.example.com/edu'
  ),
  (
    'Creative Cloud',
    'Creative Cloud',
    '60% OFF',
    'Online',
    'Creative',
    'https://lh3.googleusercontent.com/aida-public/AB6AXuBzrewh7Yaxx08JPFCRJjYZ5K9cxEFPyolBeyW8OBhUSI5x-xOOAo9x0RG4oPhNqX8GgKbLiBOnF8dV7M27keE7jCT7Gb1rS3VfkKgVPcA3bj7ZWZ3XPQHy8gFkElPs9lQq95eBonjtM0EUVHkz_SZ7cLVwqn5-H3WSDGf4Eu4kuHf9SpzmdT3GSnV97tcJJYYI6u83KKtolla22Lx0IuvDu7I4gP9ja9hrdmhbGjftDHpBwa_SQX_2k7rNKhnHjcUK9QIMLab3iMs',
    'Full suite of professional tools for photography, design, video, and UI/UX projects.',
    'CREATIVE60',
    'https://creativecloud.example.com/students'
  ),
  (
    'ByteBooks',
    'ByteBooks',
    '30% OFF',
    'Online',
    'Tech',
    'https://lh3.googleusercontent.com/aida-public/AB6AXuCdG-2Jqc1sFEzIzRESXx8K8BItiMhQ7Fe3m2AwiW40ScLzJS5LQ56bEj7jshQCDva9eMVA3JrRls31IJeWBNFPDgcG34uqhvhI22s9ESRnEM9Sj4PrzhV6bT4iYZ_fNn89yaKc9JQ7vEujYUUEPKsmArVBU2fOiY7723xXXQqv1mafUPMNq6AEmiayO1B7SUoBrZ36-V_W_E9mrI_8zAN37_jT-EjpmU0mpdudzYqAiGr_HJIpgtCCHHK492hiHpyw442eXsFueEc',
    'Premium laptops and accessories built for students who code, design, and create.',
    'BYTEBOOK30',
    'https://bytebooks.example.com/student-discount'
  ),
  (
    'Grind House',
    'Grind House',
    'Buy 1 Get 1',
    'In-Store',
    'Coffee',
    'https://lh3.googleusercontent.com/aida-public/AB6AXuDvOrc_ZGFRba9R0_nKoRINZ5tRxNmW-4lIEr_V0GN6gXTnSu7DWgW5rQ4_n0v7d2cmf-H5R-SgaRn5RmvjhFlwbLM5UaZiogKwcUmnk3G4V6a27DcVlGWQMnbwd1mKvUY-y6DAVR9gpxHs9OYCv1EgUKpslQDiRzFMn1Ou0XmJN5NL88ScH4IYQmD-qmZzIgsGr-8rFCDl-9fqQMueV77q82InBqAHqrDWYRIdNQShFMx54sbJnELdQf2gvbkpzZ0HES91UohXj2A',
    'Artisan blends and cozy study spots — perfect for your next all-night cram session.',
    'c3d4e5f6-a7b8-9012-cdef-123456789012',
    NULL
  ),
  (
    'FitFuel',
    'FitFuel',
    '20% OFF',
    'Online',
    'Fitness',
    'https://lh3.googleusercontent.com/aida-public/AB6AXuBlQ36ohtoAh9iCNqXOhzdY_i9C66nAuwPjEoY7ATPU7F6ORrkJ9RNozLPw-UlMH_AQ6347sUVdnofSpsAPDPcEDTbHI8kJ-sDd4U4-FL7KtVn0Vid0AKYeDKMnI3_zrZVee7dE003pYw1DkC4gX1Zu8gPPZpyP8zuwQXr8nMXfnT_uQQ8dElkjTXuO7k0Qc_YLrFAX7Ad1UFcbhm5fe5ZOEXLXSjyn2WLYkVCVBMx6LLOVrjorS4brUS3XyKYwP0blJjuevpgSx-Q',
    'Supplements, protein shakes, and workout gear to keep you performing at your best.',
    'FITFUEL20',
    'https://fitfuel.example.com/students'
  ),
  (
    'ThreadLine',
    'ThreadLine',
    '35% OFF',
    'In-Store',
    'Clothing',
    'https://lh3.googleusercontent.com/aida-public/AB6AXuCzOvLNPgk03USFCKNu-GSzr9_dG9Cm3IPn04us2RsA5WNrpv7kXluz1pKVGDoWg25RiLBQB1fB29I5ZtSSxP-VRZO9pTj4_i7YzmJQGsB5rWtNPQYfBMSpYn8ecO1qkcOImTsFwhBvI9d_zwBCanWoMsWcoGglkPVREOwhsLl4333y_W6F-aBfjPfU0jhgJf8o-43sazueipq-nYtKuUCo56Hh3oQ1uWZJ6v_XJep8TPKq9lSRlBs9a7UD7DDWezf0kbdke4zHLvA',
    'Streetwear meets sustainability — limited drops and campus-ready essentials.',
    'd4e5f6a7-b8c9-0123-defa-234567890123',
    NULL
  ),
  (
    'Nest & Rest',
    'Nest & Rest',
    '15% OFF',
    'Online',
    'Home',
    'https://lh3.googleusercontent.com/aida-public/AB6AXuAZJkcufRYEZVBJQHpPPMMFRRa666JoWSP--59sPJn-M8ZQeeSSxdKIwlVoClxOXzXBkbWLnBjnSTeu3ZbVd9bwUZrllroLwKliU1H0NZAdsUaTJRWnKE0OtKjq0C6PLsuEeBBaxYg1twgDiskLcyPcjOZjP3IRopDylKF6eRD0uLoKbXdzTR630xOd9-btXTE0Odtm79tP7Gb7goFCqRbK7VMJG-8OxL_V4-SNH5DS_OliUk6NEnRVxzgpXA350ggKALFQL5WQOkg',
    'Bedding, lighting, and dorm essentials that turn any room into a relaxation zone.',
    'NESTREST15',
    'https://nestandrest.example.com/edu'
  ),
  (
    'PixelForge',
    'PixelForge',
    '40% OFF',
    'In-Store',
    'Creative',
    'https://lh3.googleusercontent.com/aida-public/AB6AXuBzrewh7Yaxx08JPFCRJjYZ5K9cxEFPyolBeyW8OBhUSI5x-xOOAo9x0RG4oPhNqX8GgKbLiBOnF8dV7M27keE7jCT7Gb1rS3VfkKgVPcA3bj7ZWZ3XPQHy8gFkElPs9lQq95eBonjtM0EUVHkz_SZ7cLVwqn5-H3WSDGf4Eu4kuHf9SpzmdT3GSnV97tcJJYYI6u83KKtolla22Lx0IuvDu7I4gP9ja9hrdmhbGjftDHpBwa_SQX_2k7rNKhnHjcUK9QIMLab3iMs',
    'Cameras, drawing tablets, and studio gear for the next generation of creators.',
    'e5f6a7b8-c9d0-1234-efab-345678901234',
    NULL
  );
