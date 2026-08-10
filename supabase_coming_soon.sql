-- Coming Soon: teaser listings before launch + redeem gates
-- Deals: start_time = go-live. Events: publish_at = listing unlock (separate from start_time).

-- ────────────────────────────────────────────────────────────
-- 1. Events: listing go-live (default now → no regression)
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS publish_at timestamptz NOT NULL DEFAULT now();

-- ────────────────────────────────────────────────────────────
-- 2. Public deal listing: expose coming-soon schedule
-- ────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.get_public_deals();

CREATE FUNCTION public.get_public_deals()
RETURNS TABLE (
  id BIGINT,
  title TEXT,
  brand TEXT,
  discount TEXT,
  type TEXT,
  category TEXT,
  image_url TEXT,
  description TEXT,
  store_url TEXT,
  created_at TIMESTAMPTZ,
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  show_start_date BOOLEAN,
  show_end_date BOOLEAN,
  is_coming_soon BOOLEAN
)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    d.id,
    d.title,
    d.brand,
    d.discount,
    d.type,
    d.category,
    d.image_url,
    d.description,
    d.store_url,
    d.created_at,
    CASE
      WHEN d.start_time IS NOT NULL AND d.start_time > now() THEN d.start_time
      WHEN d.show_start_date THEN d.start_time
      ELSE NULL
    END AS start_time,
    CASE WHEN d.show_end_date THEN d.end_time ELSE NULL END AS end_time,
    d.show_start_date,
    d.show_end_date,
    (d.start_time IS NOT NULL AND d.start_time > now()) AS is_coming_soon
  FROM public.deals d
  WHERE d.status = 'approved'
  ORDER BY d.created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_deals() TO anon, authenticated;

-- ────────────────────────────────────────────────────────────
-- 3. Public deal by id: coming soon + hide redemption code
-- ────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.get_public_deal_by_id(BIGINT);

CREATE FUNCTION public.get_public_deal_by_id(target_deal_id BIGINT)
RETURNS TABLE (
  id BIGINT,
  title TEXT,
  brand TEXT,
  discount TEXT,
  type TEXT,
  category TEXT,
  image_url TEXT,
  description TEXT,
  redemption_code TEXT,
  store_url TEXT,
  created_at TIMESTAMPTZ,
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  show_start_date BOOLEAN,
  show_end_date BOOLEAN,
  is_coming_soon BOOLEAN
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_id UUID := auth.uid();
  caller_role TEXT := public.get_user_role();
  can_view_redemption_code BOOLEAN := FALSE;
  has_is_verified_column BOOLEAN := FALSE;
  deal_is_coming_soon BOOLEAN := FALSE;
BEGIN
  SELECT (d.start_time IS NOT NULL AND d.start_time > now())
  INTO deal_is_coming_soon
  FROM public.deals d
  WHERE d.id = target_deal_id
    AND d.status = 'approved'
  LIMIT 1;

  deal_is_coming_soon := COALESCE(deal_is_coming_soon, FALSE);

  IF caller_role = 'admin' THEN
    can_view_redemption_code := TRUE;

  ELSIF caller_role = 'partner' THEN
    SELECT (d.brand_id IS NOT NULL
            AND d.brand_id = public.get_partner_brand_id(caller_id))
    INTO can_view_redemption_code
    FROM public.deals d
    WHERE d.id = target_deal_id;

    can_view_redemption_code := COALESCE(can_view_redemption_code, FALSE);

  ELSE
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'user_roles'
        AND column_name = 'is_verified'
    )
    INTO has_is_verified_column;

    IF has_is_verified_column AND caller_id IS NOT NULL THEN
      EXECUTE 'SELECT COALESCE(is_verified, FALSE) FROM public.user_roles WHERE user_id = $1 LIMIT 1'
      INTO can_view_redemption_code
      USING caller_id;

      can_view_redemption_code := COALESCE(can_view_redemption_code, FALSE);
    END IF;
  END IF;

  -- Coming soon: never expose redemption codes to students
  IF deal_is_coming_soon AND caller_role NOT IN ('admin', 'partner') THEN
    can_view_redemption_code := FALSE;
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
    d.description,
    CASE
      WHEN can_view_redemption_code THEN d.redemption_code
      ELSE NULL
    END AS redemption_code,
    d.store_url,
    d.created_at,
    CASE
      WHEN d.start_time IS NOT NULL AND d.start_time > now() THEN d.start_time
      WHEN d.show_start_date THEN d.start_time
      ELSE NULL
    END AS start_time,
    CASE WHEN d.show_end_date THEN d.end_time ELSE NULL END AS end_time,
    d.show_start_date,
    d.show_end_date,
    (d.start_time IS NOT NULL AND d.start_time > now()) AS is_coming_soon
  FROM public.deals d
  WHERE d.status = 'approved'
    AND d.id = target_deal_id
  LIMIT 1;
END
$$;

GRANT EXECUTE ON FUNCTION public.get_public_deal_by_id(BIGINT) TO anon, authenticated;

-- ────────────────────────────────────────────────────────────
-- 4. Gate in-store ticket generation by start/end window
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
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.'
      USING ERRCODE = '42501';
  END IF;

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

-- ────────────────────────────────────────────────────────────
-- 5. Gate online code events by start/end window
-- ────────────────────────────────────────────────────────────
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
  deal_row RECORD;
BEGIN
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.'
      USING ERRCODE = '42501';
  END IF;

  IF normalized_type NOT IN ('reveal', 'copy', 'click_through') THEN
    RAISE EXCEPTION 'Invalid event type. Must be reveal, copy, or click_through.'
      USING ERRCODE = '22023';
  END IF;

  SELECT d.id, d.status, d.start_time, d.end_time
  INTO deal_row
  FROM public.deals d
  WHERE d.id = target_deal_id
  LIMIT 1;

  IF deal_row.id IS NULL OR deal_row.status <> 'approved' THEN
    RAISE EXCEPTION 'Deal not found or not active.'
      USING ERRCODE = 'P0002';
  END IF;

  IF deal_row.start_time IS NOT NULL AND deal_row.start_time > now() THEN
    RAISE EXCEPTION 'This deal is not live yet. It launches soon.'
      USING ERRCODE = '22023';
  END IF;

  IF deal_row.end_time IS NOT NULL AND deal_row.end_time < now() THEN
    RAISE EXCEPTION 'This deal has ended.'
      USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.online_code_events (deal_id, student_id, event_type)
  VALUES (target_deal_id, caller_id, normalized_type)
  RETURNING id INTO new_id;

  RETURN new_id;
END
$$;

GRANT EXECUTE ON FUNCTION public.log_online_code_event(BIGINT, TEXT) TO authenticated;
