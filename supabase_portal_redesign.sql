-- ============================================================
-- Uni Deals — Portal Redesign & Redemption System Overhaul
-- ============================================================
-- Run AFTER supabase_partner_access.sql and supabase_student_verification.sql.
--
-- This migration adds:
--   1. student_redemption_tickets — unique per-student in-store QR tickets
--   2. online_code_events — tracking for online code reveals/copies/clicks
--   3. New deal columns: expires_at, max_reveals, store_url default
--   4. Admin user management RPCs
--   5. In-store ticket generation & validation RPCs
-- ============================================================


-- ────────────────────────────────────────────────────────────
-- 1. IN-STORE UNIQUE TICKET SYSTEM
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.student_redemption_tickets (
  id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  deal_id         BIGINT NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  student_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ticket_code     TEXT NOT NULL UNIQUE,
  expires_at      TIMESTAMPTZ NOT NULL,
  redeemed_at     TIMESTAMPTZ,
  redeemed_by_partner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS student_tickets_deal_student_idx
  ON public.student_redemption_tickets (deal_id, student_id);
CREATE INDEX IF NOT EXISTS student_tickets_code_idx
  ON public.student_redemption_tickets (ticket_code);
CREATE INDEX IF NOT EXISTS student_tickets_expires_at_idx
  ON public.student_redemption_tickets (expires_at);

ALTER TABLE public.student_redemption_tickets ENABLE ROW LEVEL SECURITY;

-- Students can read their own tickets
DROP POLICY IF EXISTS "Students can read own tickets" ON public.student_redemption_tickets;
CREATE POLICY "Students can read own tickets"
  ON public.student_redemption_tickets
  FOR SELECT
  USING (auth.uid() = student_id);

-- Partners can read tickets for their brand deals (needed for scanner)
DROP POLICY IF EXISTS "Partners can read brand tickets" ON public.student_redemption_tickets;
CREATE POLICY "Partners can read brand tickets"
  ON public.student_redemption_tickets
  FOR SELECT
  USING (
    public.get_user_role() = 'partner'
    AND EXISTS (
      SELECT 1 FROM public.deals d
      WHERE d.id = deal_id
        AND lower(d.brand) = lower(public.get_partner_brand(auth.uid()))
    )
  );

-- Admins can read all tickets
DROP POLICY IF EXISTS "Admins can read all tickets" ON public.student_redemption_tickets;
CREATE POLICY "Admins can read all tickets"
  ON public.student_redemption_tickets
  FOR SELECT
  USING (public.get_user_role() = 'admin');

-- Only server-side RPCs (SECURITY DEFINER) insert/update tickets.
-- No direct insert/update policies for end users.


-- ────────────────────────────────────────────────────────────
-- 2. Generate a unique in-store ticket for a student
-- ────────────────────────────────────────────────────────────

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
  has_is_verified_column BOOLEAN := FALSE;
BEGIN
  -- Must be authenticated
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.'
      USING ERRCODE = '42501';
  END IF;

  -- Check verification status for non-privileged roles
  IF caller_role NOT IN ('admin', 'partner') THEN
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'user_roles'
        AND column_name = 'is_verified'
    )
    INTO has_is_verified_column;

    IF has_is_verified_column THEN
      EXECUTE 'SELECT COALESCE(is_verified, FALSE) FROM public.user_roles WHERE user_id = $1 LIMIT 1'
      INTO has_verified
      USING caller_id;
    END IF;

    IF NOT COALESCE(has_verified, FALSE) THEN
      RAISE EXCEPTION 'Student verification required to generate tickets.'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  -- Validate target deal exists and is approved
  SELECT d.id, d.title, d.brand, d.discount, d.type, d.status
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

  IF target_deal.type <> 'In-Store' THEN
    RAISE EXCEPTION 'Tickets can only be generated for in-store deals.'
      USING ERRCODE = '22023';
  END IF;

  -- Check for an existing non-expired, non-redeemed ticket
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
    -- Return existing active ticket
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

  -- Generate a unique short code: UD- + 6 alphanumeric chars
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


-- ────────────────────────────────────────────────────────────
-- 3. Validate an in-store ticket (called by partner scanner)
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.validate_instore_ticket(
  scanned_payload TEXT,
  scan_method TEXT DEFAULT 'camera'
)
RETURNS TABLE (
  event_id BIGINT,
  result TEXT,
  message TEXT,
  deal_id BIGINT,
  deal_title TEXT,
  deal_brand TEXT,
  deal_discount TEXT,
  deal_status TEXT,
  ticket_id BIGINT,
  confirmed_redemption_id BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_id UUID := auth.uid();
  caller_role TEXT := public.get_user_role();
  partner_brand TEXT;
  normalized_payload TEXT := trim(COALESCE(scanned_payload, ''));
  normalized_method TEXT := lower(trim(COALESCE(scan_method, 'camera')));
  parsed_code TEXT;
  ticket_record RECORD;
  deal_record RECORD;
  new_event_id BIGINT;
  new_confirmed_id BIGINT;
BEGIN
  -- Auth check
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.'
      USING ERRCODE = '42501';
  END IF;

  IF caller_role <> 'partner' THEN
    RAISE EXCEPTION 'Only partners can validate tickets.'
      USING ERRCODE = '42501';
  END IF;

  partner_brand := public.get_partner_brand(caller_id);

  IF partner_brand IS NULL OR trim(partner_brand) = '' THEN
    RAISE EXCEPTION 'Partner brand profile not found.'
      USING ERRCODE = '42501';
  END IF;

  IF normalized_method NOT IN ('camera', 'manual') THEN
    normalized_method := 'camera';
  END IF;

  -- Parse the ticket code from QR payload
  parsed_code := normalized_payload;

  -- Strip unideals:// prefix if present
  IF left(lower(parsed_code), length('unideals://ticket/')) = 'unideals://ticket/' THEN
    parsed_code := substr(parsed_code, length('unideals://ticket/') + 1);
  ELSIF left(lower(parsed_code), length('unideals://redeem/')) = 'unideals://redeem/' THEN
    parsed_code := substr(parsed_code, length('unideals://redeem/') + 1);
  END IF;

  parsed_code := upper(trim(parsed_code));

  -- Empty code
  IF parsed_code = '' THEN
    INSERT INTO public.redemption_events (partner_id, deal_id, brand, scanned_code, scan_method, scan_result)
    VALUES (caller_id, NULL, partner_brand, '', normalized_method, 'invalid')
    RETURNING id INTO new_event_id;

    event_id := new_event_id;
    result := 'invalid';
    message := 'Could not detect a valid ticket code.';
    deal_id := NULL; deal_title := NULL; deal_brand := partner_brand;
    deal_discount := NULL; deal_status := NULL; ticket_id := NULL;
    confirmed_redemption_id := NULL;
    RETURN NEXT; RETURN;
  END IF;

  -- First try: look up as a ticket code (UD-XXXXXX format)
  SELECT t.id, t.deal_id, t.student_id, t.ticket_code, t.expires_at, t.redeemed_at
  INTO ticket_record
  FROM public.student_redemption_tickets t
  WHERE upper(t.ticket_code) = parsed_code
  LIMIT 1;

  -- If found as a ticket, validate it
  IF ticket_record.id IS NOT NULL THEN
    -- Get the deal info
    SELECT d.id, d.title, d.brand, d.discount, d.status
    INTO deal_record
    FROM public.deals d
    WHERE d.id = ticket_record.deal_id
    LIMIT 1;

    -- Check brand match
    IF deal_record.id IS NULL OR lower(deal_record.brand) <> lower(partner_brand) THEN
      INSERT INTO public.redemption_events (partner_id, deal_id, brand, scanned_code, scan_method, scan_result)
      VALUES (caller_id, deal_record.id, partner_brand, parsed_code, normalized_method, 'wrong_brand')
      RETURNING id INTO new_event_id;

      event_id := new_event_id;
      result := 'wrong_brand';
      message := 'This ticket belongs to a different brand.';
      deal_id := deal_record.id; deal_title := deal_record.title;
      deal_brand := deal_record.brand; deal_discount := deal_record.discount;
      deal_status := deal_record.status; ticket_id := ticket_record.id;
      confirmed_redemption_id := NULL;
      RETURN NEXT; RETURN;
    END IF;

    -- Check if already redeemed
    IF ticket_record.redeemed_at IS NOT NULL THEN
      INSERT INTO public.redemption_events (partner_id, deal_id, brand, scanned_code, scan_method, scan_result)
      VALUES (caller_id, deal_record.id, partner_brand, parsed_code, normalized_method, 'invalid')
      RETURNING id INTO new_event_id;

      event_id := new_event_id;
      result := 'already_redeemed';
      message := 'This ticket has already been redeemed.';
      deal_id := deal_record.id; deal_title := deal_record.title;
      deal_brand := deal_record.brand; deal_discount := deal_record.discount;
      deal_status := deal_record.status; ticket_id := ticket_record.id;
      confirmed_redemption_id := NULL;
      RETURN NEXT; RETURN;
    END IF;

    -- Check if expired
    IF ticket_record.expires_at < NOW() THEN
      INSERT INTO public.redemption_events (partner_id, deal_id, brand, scanned_code, scan_method, scan_result)
      VALUES (caller_id, deal_record.id, partner_brand, parsed_code, normalized_method, 'invalid')
      RETURNING id INTO new_event_id;

      event_id := new_event_id;
      result := 'expired';
      message := 'This ticket has expired. The student must generate a new one.';
      deal_id := deal_record.id; deal_title := deal_record.title;
      deal_brand := deal_record.brand; deal_discount := deal_record.discount;
      deal_status := deal_record.status; ticket_id := ticket_record.id;
      confirmed_redemption_id := NULL;
      RETURN NEXT; RETURN;
    END IF;

    -- Check deal is still approved
    IF deal_record.status <> 'approved' THEN
      INSERT INTO public.redemption_events (partner_id, deal_id, brand, scanned_code, scan_method, scan_result)
      VALUES (caller_id, deal_record.id, partner_brand, parsed_code, normalized_method, 'not_approved')
      RETURNING id INTO new_event_id;

      event_id := new_event_id;
      result := 'not_approved';
      message := format('Ticket is for %s, but this deal is %s.', deal_record.title, deal_record.status);
      deal_id := deal_record.id; deal_title := deal_record.title;
      deal_brand := deal_record.brand; deal_discount := deal_record.discount;
      deal_status := deal_record.status; ticket_id := ticket_record.id;
      confirmed_redemption_id := NULL;
      RETURN NEXT; RETURN;
    END IF;

    -- ✅ VALID — Mark ticket as redeemed and log
    UPDATE public.student_redemption_tickets
    SET redeemed_at = NOW(),
        redeemed_by_partner_id = caller_id
    WHERE id = ticket_record.id;

    INSERT INTO public.redemption_events (partner_id, deal_id, brand, scanned_code, scan_method, scan_result)
    VALUES (caller_id, deal_record.id, partner_brand, parsed_code, normalized_method, 'valid')
    RETURNING id INTO new_event_id;

    INSERT INTO public.confirmed_redemptions (partner_id, deal_id, brand, redemption_code, source_event_id)
    VALUES (caller_id, deal_record.id, deal_record.brand, parsed_code, new_event_id)
    RETURNING id INTO new_confirmed_id;

    event_id := new_event_id;
    result := 'valid';
    message := format('✓ Valid ticket for %s — %s. Discount: %s', deal_record.brand, deal_record.title, deal_record.discount);
    deal_id := deal_record.id; deal_title := deal_record.title;
    deal_brand := deal_record.brand; deal_discount := deal_record.discount;
    deal_status := deal_record.status; ticket_id := ticket_record.id;
    confirmed_redemption_id := new_confirmed_id;
    RETURN NEXT; RETURN;
  END IF;

  -- Fallback: try the old redemption_code lookup for backward compatibility
  -- (handles legacy codes that aren't tickets)
  DECLARE
    legacy_match RECORD;
    legacy_brand_match RECORD;
  BEGIN
    SELECT d.id, d.title, d.brand, d.discount, d.status
    INTO legacy_match
    FROM public.deals d
    WHERE lower(trim(d.redemption_code)) = lower(trim(parsed_code))
    ORDER BY d.created_at DESC
    LIMIT 1;

    IF legacy_match.id IS NULL THEN
      INSERT INTO public.redemption_events (partner_id, deal_id, brand, scanned_code, scan_method, scan_result)
      VALUES (caller_id, NULL, partner_brand, parsed_code, normalized_method, 'not_found')
      RETURNING id INTO new_event_id;

      event_id := new_event_id;
      result := 'not_found';
      message := 'Code not found. Not a valid ticket or redemption code.';
      deal_id := NULL; deal_title := NULL; deal_brand := partner_brand;
      deal_discount := NULL; deal_status := NULL; ticket_id := NULL;
      confirmed_redemption_id := NULL;
      RETURN NEXT; RETURN;
    END IF;

    -- Check brand match for legacy codes
    IF lower(legacy_match.brand) <> lower(partner_brand) THEN
      INSERT INTO public.redemption_events (partner_id, deal_id, brand, scanned_code, scan_method, scan_result)
      VALUES (caller_id, legacy_match.id, partner_brand, parsed_code, normalized_method, 'wrong_brand')
      RETURNING id INTO new_event_id;

      event_id := new_event_id;
      result := 'wrong_brand';
      message := 'Code belongs to a different brand.';
      deal_id := legacy_match.id; deal_title := legacy_match.title;
      deal_brand := legacy_match.brand; deal_discount := legacy_match.discount;
      deal_status := legacy_match.status; ticket_id := NULL;
      confirmed_redemption_id := NULL;
      RETURN NEXT; RETURN;
    END IF;

    IF legacy_match.status <> 'approved' THEN
      INSERT INTO public.redemption_events (partner_id, deal_id, brand, scanned_code, scan_method, scan_result)
      VALUES (caller_id, legacy_match.id, partner_brand, parsed_code, normalized_method, 'not_approved')
      RETURNING id INTO new_event_id;

      event_id := new_event_id;
      result := 'not_approved';
      message := format('Code matched %s, but this deal is %s.', legacy_match.title, legacy_match.status);
      deal_id := legacy_match.id; deal_title := legacy_match.title;
      deal_brand := legacy_match.brand; deal_discount := legacy_match.discount;
      deal_status := legacy_match.status; ticket_id := NULL;
      confirmed_redemption_id := NULL;
      RETURN NEXT; RETURN;
    END IF;

    -- Valid legacy code
    INSERT INTO public.redemption_events (partner_id, deal_id, brand, scanned_code, scan_method, scan_result)
    VALUES (caller_id, legacy_match.id, partner_brand, parsed_code, normalized_method, 'valid')
    RETURNING id INTO new_event_id;

    INSERT INTO public.confirmed_redemptions (partner_id, deal_id, brand, redemption_code, source_event_id)
    VALUES (caller_id, legacy_match.id, legacy_match.brand, parsed_code, new_event_id)
    RETURNING id INTO new_confirmed_id;

    event_id := new_event_id;
    result := 'valid';
    message := format('Valid code for %s — %s.', legacy_match.brand, legacy_match.title);
    deal_id := legacy_match.id; deal_title := legacy_match.title;
    deal_brand := legacy_match.brand; deal_discount := legacy_match.discount;
    deal_status := legacy_match.status; ticket_id := NULL;
    confirmed_redemption_id := new_confirmed_id;
    RETURN NEXT; RETURN;
  END;
END
$$;

GRANT EXECUTE ON FUNCTION public.validate_instore_ticket(TEXT, TEXT) TO authenticated;


-- ────────────────────────────────────────────────────────────
-- 4. ONLINE CODE TRACKING
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.online_code_events (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  deal_id     BIGINT NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  student_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type  TEXT NOT NULL CHECK (event_type IN ('reveal', 'copy', 'click_through')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS online_code_events_deal_idx
  ON public.online_code_events (deal_id);
CREATE INDEX IF NOT EXISTS online_code_events_student_idx
  ON public.online_code_events (student_id);
CREATE INDEX IF NOT EXISTS online_code_events_type_idx
  ON public.online_code_events (event_type);

ALTER TABLE public.online_code_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Students can read own online events" ON public.online_code_events;
CREATE POLICY "Students can read own online events"
  ON public.online_code_events
  FOR SELECT
  USING (auth.uid() = student_id);

DROP POLICY IF EXISTS "Partners can read own brand online events" ON public.online_code_events;
CREATE POLICY "Partners can read own brand online events"
  ON public.online_code_events
  FOR SELECT
  USING (
    public.get_user_role() = 'partner'
    AND EXISTS (
      SELECT 1 FROM public.deals d
      WHERE d.id = deal_id
        AND lower(d.brand) = lower(public.get_partner_brand(auth.uid()))
    )
  );

DROP POLICY IF EXISTS "Admins can read all online events" ON public.online_code_events;
CREATE POLICY "Admins can read all online events"
  ON public.online_code_events
  FOR SELECT
  USING (public.get_user_role() = 'admin');

-- RPC to log an online code event
CREATE OR REPLACE FUNCTION public.log_online_code_event(
  target_deal_id BIGINT,
  target_event_type TEXT
)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_id UUID := auth.uid();
  normalized_type TEXT := lower(trim(COALESCE(target_event_type, '')));
  new_id BIGINT;
BEGIN
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.'
      USING ERRCODE = '42501';
  END IF;

  IF normalized_type NOT IN ('reveal', 'copy', 'click_through') THEN
    RAISE EXCEPTION 'Invalid event type. Must be reveal, copy, or click_through.'
      USING ERRCODE = '22023';
  END IF;

  -- Verify deal exists
  IF NOT EXISTS (SELECT 1 FROM public.deals WHERE id = target_deal_id AND status = 'approved') THEN
    RAISE EXCEPTION 'Deal not found or not active.'
      USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO public.online_code_events (deal_id, student_id, event_type)
  VALUES (target_deal_id, caller_id, normalized_type)
  RETURNING id INTO new_id;

  RETURN new_id;
END
$$;

GRANT EXECUTE ON FUNCTION public.log_online_code_event(BIGINT, TEXT) TO authenticated;


-- ────────────────────────────────────────────────────────────
-- 5. DEAL TABLE ENHANCEMENTS
-- ────────────────────────────────────────────────────────────

-- Add expiry date for deals
ALTER TABLE public.deals
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

-- Add max reveals for online deals
ALTER TABLE public.deals
  ADD COLUMN IF NOT EXISTS max_reveals INTEGER;

-- Ensure store_url column exists (should already from schema.sql)
ALTER TABLE public.deals
  ADD COLUMN IF NOT EXISTS store_url TEXT;


-- ────────────────────────────────────────────────────────────
-- 6. ADMIN USER MANAGEMENT RPCs
-- ────────────────────────────────────────────────────────────

-- List all users with roles (admin-only)
CREATE OR REPLACE FUNCTION public.list_users_with_roles(
  search_query TEXT DEFAULT '',
  role_filter TEXT DEFAULT NULL,
  page_limit INTEGER DEFAULT 50,
  page_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  user_id UUID,
  email TEXT,
  role TEXT,
  is_verified BOOLEAN,
  brand_name TEXT,
  created_at TIMESTAMPTZ,
  total_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  has_is_verified_column BOOLEAN := FALSE;
BEGIN
  IF public.get_user_role() <> 'admin' THEN
    RAISE EXCEPTION 'Only admins can list users.'
      USING ERRCODE = '42501';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'user_roles'
      AND column_name = 'is_verified'
  )
  INTO has_is_verified_column;

  IF has_is_verified_column THEN
    RETURN QUERY
    SELECT
      au.id AS user_id,
      au.email::TEXT AS email,
      COALESCE(ur.role::text, 'student') AS role,
      COALESCE(ur.is_verified, FALSE) AS is_verified,
      COALESCE(b.name, pp.brand_name)::TEXT AS brand_name,
      au.created_at AS created_at,
      COUNT(*) OVER() AS total_count
    FROM auth.users au
    LEFT JOIN public.user_roles ur ON ur.user_id = au.id
    LEFT JOIN public.partner_profiles pp ON pp.user_id = au.id
    LEFT JOIN public.brands b ON b.id = pp.brand_id
    WHERE (
      search_query = ''
      OR au.email ILIKE '%' || search_query || '%'
      OR COALESCE(b.name, pp.brand_name) ILIKE '%' || search_query || '%'
    )
    AND (
      role_filter IS NULL
      OR COALESCE(ur.role::text, 'student') = role_filter
    )
    ORDER BY au.created_at DESC
    LIMIT page_limit
    OFFSET page_offset;
  ELSE
    RETURN QUERY
    SELECT
      au.id AS user_id,
      au.email::TEXT AS email,
      COALESCE(ur.role::text, 'student') AS role,
      FALSE AS is_verified,
      COALESCE(b.name, pp.brand_name)::TEXT AS brand_name,
      au.created_at AS created_at,
      COUNT(*) OVER() AS total_count
    FROM auth.users au
    LEFT JOIN public.user_roles ur ON ur.user_id = au.id
    LEFT JOIN public.partner_profiles pp ON pp.user_id = au.id
    LEFT JOIN public.brands b ON b.id = pp.brand_id
    WHERE (
      search_query = ''
      OR au.email ILIKE '%' || search_query || '%'
      OR COALESCE(b.name, pp.brand_name) ILIKE '%' || search_query || '%'
    )
    AND (
      role_filter IS NULL
      OR COALESCE(ur.role::text, 'student') = role_filter
    )
    ORDER BY au.created_at DESC
    LIMIT page_limit
    OFFSET page_offset;
  END IF;
END
$$;

GRANT EXECUTE ON FUNCTION public.list_users_with_roles(TEXT, TEXT, INTEGER, INTEGER) TO authenticated;


-- Demote a partner back to student (admin-only)
CREATE OR REPLACE FUNCTION public.demote_user_to_student(target_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_role TEXT;
BEGIN
  IF public.get_user_role() <> 'admin' THEN
    RAISE EXCEPTION 'Only admins can demote users.'
      USING ERRCODE = '42501';
  END IF;

  SELECT role INTO target_role
  FROM public.user_roles
  WHERE user_id = target_user_id;

  IF target_role = 'admin' THEN
    RAISE EXCEPTION 'Cannot demote admin users.'
      USING ERRCODE = '22023';
  END IF;

  UPDATE public.user_roles
  SET role = 'student'
  WHERE user_id = target_user_id;

  -- Remove partner profile but keep deals for history
  DELETE FROM public.partner_profiles
  WHERE user_id = target_user_id;
END
$$;

GRANT EXECUTE ON FUNCTION public.demote_user_to_student(UUID) TO authenticated;


-- Get all deals for admin management (with online tracking stats)
CREATE OR REPLACE FUNCTION public.admin_list_all_deals(
  status_filter TEXT DEFAULT NULL,
  search_query TEXT DEFAULT '',
  page_limit INTEGER DEFAULT 50,
  page_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  id BIGINT,
  title TEXT,
  brand TEXT,
  discount TEXT,
  type TEXT,
  category TEXT,
  image_url TEXT,
  status TEXT,
  redemption_code TEXT,
  store_url TEXT,
  partner_id UUID,
  expires_at TIMESTAMPTZ,
  max_reveals INTEGER,
  created_at TIMESTAMPTZ,
  total_reveals BIGINT,
  total_copies BIGINT,
  total_click_throughs BIGINT,
  total_tickets_generated BIGINT,
  total_tickets_redeemed BIGINT,
  total_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.get_user_role() <> 'admin' THEN
    RAISE EXCEPTION 'Only admins can list all deals.'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    d.id,
    d.title,
    d.brand,
    d.discount,
    d.type,
    d.category,
    d.image_url,
    d.status::text,
    d.redemption_code,
    d.store_url,
    d.partner_id,
    d.expires_at,
    d.max_reveals,
    d.created_at,
    COALESCE((SELECT COUNT(*) FROM public.online_code_events oce WHERE oce.deal_id = d.id AND oce.event_type = 'reveal'), 0)::BIGINT AS total_reveals,
    COALESCE((SELECT COUNT(*) FROM public.online_code_events oce WHERE oce.deal_id = d.id AND oce.event_type = 'copy'), 0)::BIGINT AS total_copies,
    COALESCE((SELECT COUNT(*) FROM public.online_code_events oce WHERE oce.deal_id = d.id AND oce.event_type = 'click_through'), 0)::BIGINT AS total_click_throughs,
    COALESCE((SELECT COUNT(*) FROM public.student_redemption_tickets srt WHERE srt.deal_id = d.id), 0)::BIGINT AS total_tickets_generated,
    COALESCE((SELECT COUNT(*) FROM public.student_redemption_tickets srt WHERE srt.deal_id = d.id AND srt.redeemed_at IS NOT NULL), 0)::BIGINT AS total_tickets_redeemed,
    COUNT(*) OVER() AS total_count
  FROM public.deals d
  WHERE (
    status_filter IS NULL
    OR d.status::text = status_filter
  )
  AND (
    search_query = ''
    OR d.title ILIKE '%' || search_query || '%'
    OR d.brand ILIKE '%' || search_query || '%'
  )
  ORDER BY d.created_at DESC
  LIMIT page_limit
  OFFSET page_offset;
END
$$;

GRANT EXECUTE ON FUNCTION public.admin_list_all_deals(TEXT, TEXT, INTEGER, INTEGER) TO authenticated;


-- ────────────────────────────────────────────────────────────
-- 7. PARTNER ANALYTICS: deal-level stats
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_partner_deal_stats(target_partner_id UUID DEFAULT auth.uid())
RETURNS TABLE (
  deal_id BIGINT,
  deal_title TEXT,
  deal_type TEXT,
  deal_status TEXT,
  total_reveals BIGINT,
  total_copies BIGINT,
  total_click_throughs BIGINT,
  total_tickets_generated BIGINT,
  total_tickets_redeemed BIGINT,
  total_scans BIGINT,
  confirmed_redemptions BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only the partner themselves or an admin can call this
  IF auth.uid() <> target_partner_id AND public.get_user_role() <> 'admin' THEN
    RAISE EXCEPTION 'Access denied.'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    d.id AS deal_id,
    d.title AS deal_title,
    d.type AS deal_type,
    d.status::text AS deal_status,
    COALESCE((SELECT COUNT(*) FROM public.online_code_events oce WHERE oce.deal_id = d.id AND oce.event_type = 'reveal'), 0)::BIGINT,
    COALESCE((SELECT COUNT(*) FROM public.online_code_events oce WHERE oce.deal_id = d.id AND oce.event_type = 'copy'), 0)::BIGINT,
    COALESCE((SELECT COUNT(*) FROM public.online_code_events oce WHERE oce.deal_id = d.id AND oce.event_type = 'click_through'), 0)::BIGINT,
    COALESCE((SELECT COUNT(*) FROM public.student_redemption_tickets srt WHERE srt.deal_id = d.id), 0)::BIGINT,
    COALESCE((SELECT COUNT(*) FROM public.student_redemption_tickets srt WHERE srt.deal_id = d.id AND srt.redeemed_at IS NOT NULL), 0)::BIGINT,
    COALESCE((SELECT COUNT(*) FROM public.redemption_events re WHERE re.deal_id = d.id), 0)::BIGINT,
    COALESCE((SELECT COUNT(*) FROM public.confirmed_redemptions cr WHERE cr.deal_id = d.id), 0)::BIGINT
  FROM public.deals d
  WHERE d.partner_id = target_partner_id
  ORDER BY d.created_at DESC;
END
$$;

GRANT EXECUTE ON FUNCTION public.get_partner_deal_stats(UUID) TO authenticated;
