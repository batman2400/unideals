-- Global student perks (GitHub Student Pack, Gemini for students, and similar).
-- Run once in the Supabase SQL editor before the app and website screens work.
-- These are links to the provider. Uni Deals does not issue their codes.
-- The starter rows are inactive. Turn a perk on from Student Perks after you
-- are happy with the wording. Re-running this file does not overwrite edits.

CREATE TABLE IF NOT EXISTS public.student_perks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_name text NOT NULL UNIQUE CHECK (char_length(btrim(provider_name)) > 0),
  logo_url text,
  category text,
  summary text NOT NULL CHECK (char_length(btrim(summary)) > 0),
  eligibility text,
  claim_steps text,
  official_url text NOT NULL CHECK (official_url ~* '^https://'),
  availability text,
  last_verified_on date,
  is_active boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS student_perks_active_sort_idx
  ON public.student_perks (sort_order, provider_name)
  WHERE is_active;

ALTER TABLE public.student_perks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Active student perks are public" ON public.student_perks;
CREATE POLICY "Active student perks are public"
  ON public.student_perks
  FOR SELECT
  USING (
    is_active
    OR public.get_user_role() = 'admin'
  );

DROP POLICY IF EXISTS "Admins manage student perks" ON public.student_perks;
CREATE POLICY "Admins manage student perks"
  ON public.student_perks
  FOR ALL TO authenticated
  USING (public.get_user_role() = 'admin')
  WITH CHECK (public.get_user_role() = 'admin');

CREATE OR REPLACE FUNCTION public.touch_student_perk_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS student_perks_touch_updated_at ON public.student_perks;
CREATE TRIGGER student_perks_touch_updated_at
  BEFORE UPDATE ON public.student_perks
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_student_perk_updated_at();

GRANT SELECT ON public.student_perks TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.student_perks TO authenticated;

INSERT INTO public.student_perks (
  provider_name,
  category,
  summary,
  eligibility,
  claim_steps,
  official_url,
  availability,
  last_verified_on,
  is_active,
  sort_order
)
VALUES
  (
    'GitHub Student Developer Pack',
    'Software',
    'Free developer tools and partner offers for verified students in a degree or diploma program. Some offers inside the pack have their own country limits.',
    'Students aged 13 or older in a degree- or diploma-granting program. A school email or dated proof of enrollment is required. Teachers are not eligible for the pack.',
    E'Open the official GitHub Student Developer Pack page.\nSign in to GitHub.\nApply with a school email or dated proof of enrollment.\nAfter approval, open the offers you want and read each partner''s own terms.',
    'https://education.github.com/pack',
    'Worldwide, including Sri Lanka',
    '2026-10-12',
    false,
    1
  ),
  (
    'Google Gemini for students',
    'AI',
    'One year of Google AI Plus at no charge for eligible university students aged 18 or older. A payment method is required. Unless you cancel, it renews at LKR 1,600 per month. Redeem by 31 December 2026.',
    'University students in Sri Lanka, aged 18 or older. Google verifies student status. A personal Google account and a valid payment method are required at sign-up.',
    E'Open the official Gemini student page for Sri Lanka.\nVerify your student status.\nAdd a payment method when Google asks.\nCancel before the free year ends if you do not want the paid renewal.',
    'https://gemini.google/lk/students/',
    'Sri Lanka',
    '2026-10-12',
    false,
    2
  ),
  (
    'JetBrains educational licenses',
    'Software',
    'Free JetBrains IDE licenses for students in a full-time program of at least one year at an accredited school.',
    'Students at accredited schools, in a full-time program of at least one year that includes programming. JetBrains does not publish a country block. Your school must be accepted when you apply.',
    E'Open the official JetBrains education page.\nApply with your school email or the documents they ask for.\nInstall the IDE only after the educational license is approved.',
    'https://www.jetbrains.com/community/education/#students',
    'Accredited schools, including Sri Lanka when the school is accepted',
    '2026-10-12',
    false,
    3
  ),
  (
    'Autodesk Education',
    'Design',
    'Education access to Autodesk software for students at accredited schools. Access is renewed each year.',
    'Students who meet Autodesk''s age rules and are enrolled at an accredited school. Autodesk verifies eligibility. Training-centre courses do not qualify.',
    E'Open the official Autodesk Education page.\nCreate or sign in to an Autodesk account.\nVerify your student status and renew when they ask.',
    'https://www.autodesk.com/education/edu-software/overview',
    'Accredited schools worldwide, including Sri Lanka when the school is accepted',
    '2026-10-12',
    false,
    4
  ),
  (
    'Notion Education Plan',
    'Learning',
    'Free Notion Education plan for one person, for students at an accredited university that Notion recognises. A school email is required. High school students are not included.',
    'Students or teachers at an accredited college or university listed in the World Higher Education Database. The Notion account must use that school email as its main address. Notion does not accept a student ID instead. K-12 students are not eligible for this plan.',
    E'Create a Notion account with your university email as the main address.\nOpen Settings, then Upgrade plan.\nChoose the free education plan. Notion upgrades you if it recognises the school.',
    'https://www.notion.com/product/notion-for-education',
    'Universities Notion recognises, including listed Sri Lankan universities',
    '2026-10-12',
    false,
    5
  ),
  (
    'Spotify Premium Student',
    'Music',
    'Spotify Premium at LKR 375 per month for eligible students in Sri Lanka. New Premium users can get the first month free, then LKR 375 per month. A payment method is required. If you are no longer eligible, Spotify moves you to Premium Individual at LKR 749 per month.',
    'Students over 18 enrolled at an accredited higher-education institution that Spotify accepts. The discount lasts up to 4 years and must be re-verified about every 12 months. The one-month trial is for people who have not had Premium before.',
    E'Open the official Spotify student page for Sri Lanka.\nVerify your student status.\nAdd a payment method when Spotify asks.\nRe-verify when asked so the student price continues.',
    'https://www.spotify.com/lk-en/student/',
    'Sri Lanka',
    '2026-10-12',
    false,
    6
  ),
  (
    'YouTube Premium Student',
    'Video',
    'Discounted YouTube Premium or YouTube Music Premium for students in Sri Lanka. YouTube shows the current price at sign-up. The membership is verified each year and can last up to 4 years.',
    'Full-time students at a higher-education institution in Sri Lanka that appears on YouTube''s verification form. If your school is not listed, the student price is not available for that school.',
    E'Open YouTube''s student membership page.\nSearch for your school in the verification form.\nChoose YouTube Premium or YouTube Music Premium if your school is listed.\nRe-verify when YouTube asks.',
    'https://www.youtube.com/premium/student',
    'Sri Lanka, when your school is on the verification list',
    '2026-10-12',
    false,
    7
  ),
  (
    'Canva Education',
    'Design',
    'Free Canva Education for primary and secondary school students. A teacher or the school has to invite you. University and college students are not eligible for this plan.',
    'Students at a formally accredited primary or secondary school, anywhere including Sri Lanka. Canva does not give this plan to university or college students. Those students can use Canva Free unless their university has bought Canva Campus.',
    E'Ask a teacher at your school to invite you to Canva Education.\nOr sign up with your school email and request to join the school team if it appears.\nUniversity students should not apply for this plan.',
    'https://www.canva.com/education/',
    'Sri Lanka, school students only',
    '2026-10-12',
    false,
    8
  )
ON CONFLICT (provider_name) DO NOTHING;

-- Fill logos only when a row has none, so a custom logo is left alone.
UPDATE public.student_perks AS perk
SET logo_url = logos.logo_url
FROM (
  VALUES
    ('GitHub Student Developer Pack', 'https://www.unideals.co/perk-logos/github.svg'),
    ('Google Gemini for students', 'https://www.unideals.co/perk-logos/googlegemini.svg'),
    ('JetBrains educational licenses', 'https://www.unideals.co/perk-logos/jetbrains.svg'),
    ('Autodesk Education', 'https://www.unideals.co/perk-logos/autodesk.svg'),
    ('Notion Education Plan', 'https://www.unideals.co/perk-logos/notion.svg'),
    ('Spotify Premium Student', 'https://www.unideals.co/perk-logos/spotify.svg'),
    ('YouTube Premium Student', 'https://www.unideals.co/perk-logos/youtube.svg'),
    ('Canva Education', 'https://www.unideals.co/perk-logos/canva.svg')
) AS logos(provider_name, logo_url)
WHERE perk.provider_name = logos.provider_name
  AND (perk.logo_url IS NULL OR btrim(perk.logo_url) = '');

NOTIFY pgrst, 'reload schema';
