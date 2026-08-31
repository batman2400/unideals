-- Fix published blog copy that describes the old (inverted) redemption flow.
-- Safe to re-run. Also adds posts.updated_at so sitemap lastmod can use it later.

ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

UPDATE public.posts
SET content = replace(
  content,
  'Many local cafes around campus offer 10% to 15% off for verified students when you scan your QR code at the counter.',
  'Many local cafes around campus offer 10% to 15% off for verified students. Open the deal and generate an in-store ticket — the cashier scans that ticket, not your student pass.'
)
WHERE content LIKE '%scan your QR code at the counter%';

UPDATE public.posts
SET content = replace(
  content,
  '2. **Use the QR Scanner:** No paper coupons required. Just open your Scanner tab, scan the partner brand’s counter code, and watch the discount apply instantly.',
  '2. **Redeem from the deal page:** No paper coupons. Online offers reveal a promo code after you verify. In-store offers generate a timed ticket on that deal — show it to the cashier. Your Profile student pass is identity only, not a ticket.'
)
WHERE slug = 'ultimate-student-guide-maximize-discounts'
   OR content LIKE '%Use the QR Scanner%';

-- ASCII apostrophe variant (brand's vs brand’s)
UPDATE public.posts
SET content = replace(
  content,
  '2. **Use the QR Scanner:** No paper coupons required. Just open your Scanner tab, scan the partner brand''s counter code, and watch the discount apply instantly.',
  '2. **Redeem from the deal page:** No paper coupons. Online offers reveal a promo code after you verify. In-store offers generate a timed ticket on that deal — show it to the cashier. Your Profile student pass is identity only, not a ticket.'
)
WHERE content LIKE '%Use the QR Scanner%';
