-- ============================================================
-- Uni Deals — QA findings (student email + partner tickets)
--
-- Apply in the Supabase SQL editor after review.
-- Does NOT run supabase_reveal_deal_code_cutover.sql (Play wait).
-- ============================================================

BEGIN;

-- 1) Apex domains: name@sliit.lk and name@uom.lk must match.
CREATE OR REPLACE FUNCTION public.is_allowed_student_domain(candidate_email TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  normalized TEXT := lower(trim(COALESCE(candidate_email, '')));
  at_pos INTEGER;
  domain_part TEXT;
BEGIN
  at_pos := length(normalized) - position('@' IN reverse(normalized)) + 1;
  IF normalized = '' OR at_pos < 2 OR at_pos >= length(normalized) THEN
    RETURN FALSE;
  END IF;

  domain_part := substr(normalized, at_pos + 1);

  IF
    domain_part IN ('ac.lk', 'edu.lk', 'sliit.lk', 'edu', 'edu.au', 'ac.uk')
    OR domain_part LIKE '%.ac.lk'
    OR domain_part LIKE '%.edu.lk'
    OR domain_part LIKE '%.sliit.lk'
    OR domain_part LIKE '%.edu'
    OR domain_part LIKE '%.edu.au'
    OR domain_part LIKE '%.ac.uk'
  THEN
    RETURN TRUE;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.allowed_domains allowed
    WHERE domain_part = allowed.domain
       OR domain_part LIKE '%.' || allowed.domain
  );
END
$$;

GRANT EXECUTE ON FUNCTION public.is_allowed_student_domain(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_allowed_student_domain(TEXT) TO service_role;

INSERT INTO public.allowed_domains (domain, institution_name)
VALUES
  ('uom.lk', 'University of Moratuwa'),
  ('sliit.lk', 'Sri Lanka Institute of Information Technology'),
  ('nibm.lk', 'National Institute of Business Management'),
  ('nsbm.lk', 'NSBM Green University'),
  ('iit.lk', 'Informatics Institute of Technology'),
  ('apiit.lk', 'Asia Pacific Institute of Information Technology'),
  ('cinec.lk', 'CINEC Campus'),
  ('cinec.edu', 'CINEC Campus'),
  ('kiu.lk', 'KIU'),
  ('esoft.lk', 'ESOFT Metro Campus'),
  ('icbt.lk', 'ICBT Campus'),
  ('ric.lk', 'Royal Institute of Colombo'),
  ('bms.lk', 'BMS'),
  ('casrilanka.com', 'CA Sri Lanka')
ON CONFLICT (domain) DO UPDATE
SET institution_name = EXCLUDED.institution_name;

-- 2) Only verified students may mint in-store tickets.
--    Partners scan tickets; they must not mint another brand's QR.
CREATE OR REPLACE FUNCTION public.generate_instore_ticket(
  target_deal_id BIGINT,
  ticket_duration_minutes INTEGER DEFAULT 15
)
RETURNS TABLE (
  ticket_id BIGINT,
  ticket_code TEXT,
  deal_id BIGINT,
  deal_title TEXT,
  deal_brand TEXT,
  deal_discount TEXT,
  expires_at TIMESTAMPTZ,
  already_active BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_id UUID := auth.uid();
  caller_role TEXT := public.get_user_role();
  target_deal RECORD;
  existing_ticket RECORD;
  new_code TEXT;
  new_expires TIMESTAMPTZ;
  new_ticket_id BIGINT;
  has_verified BOOLEAN := FALSE;
BEGIN
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.'
      USING ERRCODE = '42501';
  END IF;

  IF COALESCE(caller_role, 'student') <> 'student' THEN
    RAISE EXCEPTION 'Only verified students can generate redemption tickets.'
      USING ERRCODE = '42501';
  END IF;

  SELECT COALESCE(is_verified, FALSE)
  INTO has_verified
  FROM public.user_roles
  WHERE user_id = caller_id
  LIMIT 1;

  IF NOT COALESCE(has_verified, FALSE) THEN
    RAISE EXCEPTION 'Student verification required to generate tickets.'
      USING ERRCODE = '42501';
  END IF;

  SELECT d.id, d.title, d.brand, d.discount, d.type, d.status, d.start_time, d.end_time
  INTO target_deal
  FROM public.deals d
  WHERE d.id = target_deal_id
  LIMIT 1;

  IF target_deal.id IS NULL THEN
    RAISE EXCEPTION 'Deal not found.'
      USING ERRCODE = 'P0002';
  END IF;

  IF target_deal.status <> 'approved' THEN
    RAISE EXCEPTION 'This deal is not currently active.'
      USING ERRCODE = '22023';
  END IF;

  IF target_deal.start_time IS NOT NULL AND target_deal.start_time > now() THEN
    RAISE EXCEPTION 'This deal is not live yet. It launches soon.'
      USING ERRCODE = '22023';
  END IF;

  IF target_deal.end_time IS NOT NULL AND target_deal.end_time < now() THEN
    RAISE EXCEPTION 'This deal has ended.'
      USING ERRCODE = '22023';
  END IF;

  IF target_deal.type <> 'In-Store' THEN
    RAISE EXCEPTION 'Tickets can only be generated for in-store deals.'
      USING ERRCODE = '22023';
  END IF;

  SELECT t.id, t.ticket_code, t.expires_at
  INTO existing_ticket
  FROM public.student_redemption_tickets t
  WHERE t.deal_id = target_deal_id
    AND t.student_id = caller_id
    AND t.redeemed_at IS NULL
    AND t.expires_at > NOW()
  ORDER BY t.created_at DESC
  LIMIT 1;

  IF existing_ticket.id IS NOT NULL THEN
    ticket_id := existing_ticket.id;
    ticket_code := existing_ticket.ticket_code;
    deal_id := target_deal.id;
    deal_title := target_deal.title;
    deal_brand := target_deal.brand;
    deal_discount := target_deal.discount;
    expires_at := existing_ticket.expires_at;
    already_active := TRUE;
    RETURN NEXT;
    RETURN;
  END IF;

  LOOP
    new_code := 'UD-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));

    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.student_redemption_tickets WHERE student_redemption_tickets.ticket_code = new_code
    );
  END LOOP;

  new_expires := NOW() + (ticket_duration_minutes || ' minutes')::interval;

  INSERT INTO public.student_redemption_tickets (
    deal_id, student_id, ticket_code, expires_at
  )
  VALUES (
    target_deal_id, caller_id, new_code, new_expires
  )
  RETURNING id INTO new_ticket_id;

  ticket_id := new_ticket_id;
  ticket_code := new_code;
  deal_id := target_deal.id;
  deal_title := target_deal.title;
  deal_brand := target_deal.brand;
  deal_discount := target_deal.discount;
  expires_at := new_expires;
  already_active := FALSE;
  RETURN NEXT;
END
$$;

GRANT EXECUTE ON FUNCTION public.generate_instore_ticket(BIGINT, INTEGER) TO authenticated;

COMMIT;
