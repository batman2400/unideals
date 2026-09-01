-- ============================================================
-- UniDeals — Reveal promo code on demand (additive)
--
-- Apply this file in the Supabase SQL editor BEFORE shipping
-- website + app clients that call reveal_online_deal_code.
--
-- Does NOT change get_public_deal_by_id. Older app builds that
-- still read redemption_code from the deal-load RPC keep working.
--
-- After the new app is on the stores, apply
-- supabase_reveal_deal_code_cutover.sql to stop sending student
-- codes on deal load.
-- ============================================================

BEGIN;

CREATE INDEX IF NOT EXISTS online_code_events_student_type_created_idx
  ON public.online_code_events (student_id, event_type, created_at DESC);

DROP FUNCTION IF EXISTS public.reveal_online_deal_code(BIGINT);

CREATE FUNCTION public.reveal_online_deal_code(target_deal_id BIGINT)
RETURNS TABLE (redemption_code TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_id UUID := auth.uid();
  caller_role TEXT := public.get_user_role();
  deal_row RECORD;
  has_verified BOOLEAN := FALSE;
  window_count INTEGER := 0;
  day_count INTEGER := 0;
BEGIN
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.'
      USING ERRCODE = '42501';
  END IF;

  IF COALESCE(caller_role, '') NOT IN ('admin', 'partner') THEN
    SELECT COALESCE(ur.is_verified, FALSE)
    INTO has_verified
    FROM public.user_roles ur
    WHERE ur.user_id = caller_id
    LIMIT 1;

    IF NOT COALESCE(has_verified, FALSE) THEN
      RAISE EXCEPTION 'Student verification required to reveal promo codes.'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  SELECT
    d.id,
    d.status,
    d.type,
    d.start_time,
    d.end_time,
    d.redemption_code
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

  IF deal_row.type <> 'Online' THEN
    RAISE EXCEPTION 'Promo codes are only available for online deals.'
      USING ERRCODE = '22023';
  END IF;

  IF deal_row.redemption_code IS NULL
     OR btrim(deal_row.redemption_code) = '' THEN
    RAISE EXCEPTION 'This offer does not currently have a valid redemption code.'
      USING ERRCODE = 'P0002';
  END IF;

  IF COALESCE(caller_role, '') NOT IN ('admin', 'partner') THEN
    SELECT COUNT(*)::INTEGER
    INTO window_count
    FROM public.online_code_events oce
    WHERE oce.student_id = caller_id
      AND oce.event_type = 'reveal'
      AND oce.created_at >= now() - INTERVAL '10 minutes';

    IF COALESCE(window_count, 0) >= 15 THEN
      RAISE EXCEPTION 'Too many reveals. Try again later.'
        USING ERRCODE = 'P0001';
    END IF;

    SELECT COUNT(*)::INTEGER
    INTO day_count
    FROM public.online_code_events oce
    WHERE oce.student_id = caller_id
      AND oce.event_type = 'reveal'
      AND oce.created_at >= now() - INTERVAL '1 day';

    IF COALESCE(day_count, 0) >= 50 THEN
      RAISE EXCEPTION 'Too many reveals. Try again later.'
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  INSERT INTO public.online_code_events (deal_id, student_id, event_type)
  VALUES (target_deal_id, caller_id, 'reveal');

  RETURN QUERY SELECT btrim(deal_row.redemption_code);
END
$$;

GRANT EXECUTE ON FUNCTION public.reveal_online_deal_code(BIGINT) TO authenticated;
REVOKE ALL ON FUNCTION public.reveal_online_deal_code(BIGINT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reveal_online_deal_code(BIGINT) FROM anon;

-- Copy / click-through still use this RPC. Require verification for students.
-- Do not rate-limit reveal here: new clients use reveal_online_deal_code;
-- older app builds still log reveal through this function.
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
  caller_role TEXT := public.get_user_role();
  normalized_type TEXT := lower(trim(COALESCE(target_event_type, '')));
  new_id BIGINT;
  deal_row RECORD;
  has_verified BOOLEAN := FALSE;
BEGIN
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.'
      USING ERRCODE = '42501';
  END IF;

  IF normalized_type NOT IN ('reveal', 'copy', 'click_through') THEN
    RAISE EXCEPTION 'Invalid event type. Must be reveal, copy, or click_through.'
      USING ERRCODE = '22023';
  END IF;

  IF COALESCE(caller_role, '') NOT IN ('admin', 'partner') THEN
    SELECT COALESCE(ur.is_verified, FALSE)
    INTO has_verified
    FROM public.user_roles ur
    WHERE ur.user_id = caller_id
    LIMIT 1;

    IF NOT COALESCE(has_verified, FALSE) THEN
      RAISE EXCEPTION 'Student verification required.'
        USING ERRCODE = '42501';
    END IF;
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

COMMIT;
