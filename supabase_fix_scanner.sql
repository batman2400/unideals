-- Fix scanner validation to use brand_id for maximum robustness

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
  partner_brand_id UUID;
  partner_brand_name TEXT;
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

  -- Get both brand_id and brand_name
  partner_brand_id := public.get_partner_brand_id(caller_id);
  partner_brand_name := public.get_partner_brand(caller_id);

  IF partner_brand_id IS NULL THEN
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
    VALUES (caller_id, NULL, partner_brand_name, '', normalized_method, 'invalid')
    RETURNING id INTO new_event_id;

    event_id := new_event_id;
    result := 'invalid';
    message := 'Could not detect a valid ticket code.';
    deal_id := NULL; deal_title := NULL; deal_brand := partner_brand_name;
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
    SELECT d.id, d.title, d.brand, d.brand_id, d.discount, d.status
    INTO deal_record
    FROM public.deals d
    WHERE d.id = ticket_record.deal_id
    LIMIT 1;

    -- Check brand match using brand_id for maximum robustness
    IF deal_record.id IS NULL OR deal_record.brand_id <> partner_brand_id THEN
      INSERT INTO public.redemption_events (partner_id, deal_id, brand, scanned_code, scan_method, scan_result)
      VALUES (caller_id, deal_record.id, partner_brand_name, parsed_code, normalized_method, 'wrong_brand')
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
      VALUES (caller_id, deal_record.id, partner_brand_name, parsed_code, normalized_method, 'invalid')
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
      VALUES (caller_id, deal_record.id, partner_brand_name, parsed_code, normalized_method, 'invalid')
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
      VALUES (caller_id, deal_record.id, partner_brand_name, parsed_code, normalized_method, 'not_approved')
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

    -- ✅ VALID - Mark ticket as redeemed and log
    UPDATE public.student_redemption_tickets
    SET redeemed_at = NOW(),
        redeemed_by_partner_id = caller_id
    WHERE id = ticket_record.id;

    INSERT INTO public.redemption_events (partner_id, deal_id, brand, scanned_code, scan_method, scan_result)
    VALUES (caller_id, deal_record.id, partner_brand_name, parsed_code, normalized_method, 'valid')
    RETURNING id INTO new_event_id;

    INSERT INTO public.confirmed_redemptions (partner_id, deal_id, brand, redemption_code, source_event_id)
    VALUES (caller_id, deal_record.id, deal_record.brand, parsed_code, new_event_id)
    RETURNING id INTO new_confirmed_id;

    event_id := new_event_id;
    result := 'valid';
    message := format('🎉 Valid ticket for %s - %s. Discount: %s', deal_record.brand, deal_record.title, deal_record.discount);
    deal_id := deal_record.id; deal_title := deal_record.title;
    deal_brand := deal_record.brand; deal_discount := deal_record.discount;
    deal_status := deal_record.status; ticket_id := ticket_record.id;
    confirmed_redemption_id := new_confirmed_id;
    RETURN NEXT; RETURN;
  END IF;

  -- Fallback: try the old redemption_code lookup for backward compatibility
  DECLARE
    legacy_match RECORD;
  BEGIN
    SELECT d.id, d.title, d.brand, d.brand_id, d.discount, d.status
    INTO legacy_match
    FROM public.deals d
    WHERE lower(trim(d.redemption_code)) = lower(trim(parsed_code))
    ORDER BY d.created_at DESC
    LIMIT 1;

    IF legacy_match.id IS NULL THEN
      INSERT INTO public.redemption_events (partner_id, deal_id, brand, scanned_code, scan_method, scan_result)
      VALUES (caller_id, NULL, partner_brand_name, parsed_code, normalized_method, 'not_found')
      RETURNING id INTO new_event_id;

      event_id := new_event_id;
      result := 'not_found';
      message := 'Code not found. Not a valid ticket or redemption code.';
      deal_id := NULL; deal_title := NULL; deal_brand := partner_brand_name;
      deal_discount := NULL; deal_status := NULL; ticket_id := NULL;
      confirmed_redemption_id := NULL;
      RETURN NEXT; RETURN;
    END IF;

    -- Check brand match for legacy codes using brand_id
    IF legacy_match.brand_id <> partner_brand_id THEN
      INSERT INTO public.redemption_events (partner_id, deal_id, brand, scanned_code, scan_method, scan_result)
      VALUES (caller_id, legacy_match.id, partner_brand_name, parsed_code, normalized_method, 'wrong_brand')
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
      VALUES (caller_id, legacy_match.id, partner_brand_name, parsed_code, normalized_method, 'not_approved')
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

    -- ✅ VALID legacy code
    INSERT INTO public.redemption_events (partner_id, deal_id, brand, scanned_code, scan_method, scan_result)
    VALUES (caller_id, legacy_match.id, partner_brand_name, parsed_code, normalized_method, 'valid')
    RETURNING id INTO new_event_id;

    INSERT INTO public.confirmed_redemptions (partner_id, deal_id, brand, redemption_code, source_event_id)
    VALUES (caller_id, legacy_match.id, legacy_match.brand, parsed_code, new_event_id)
    RETURNING id INTO new_confirmed_id;

    event_id := new_event_id;
    result := 'valid';
    message := format('🎉 Valid code for %s - %s. Discount: %s', legacy_match.brand, legacy_match.title, legacy_match.discount);
    deal_id := legacy_match.id; deal_title := legacy_match.title;
    deal_brand := legacy_match.brand; deal_discount := legacy_match.discount;
    deal_status := legacy_match.status; ticket_id := NULL;
    confirmed_redemption_id := new_confirmed_id;
    RETURN NEXT; RETURN;
  END;
END
$$;

GRANT EXECUTE ON FUNCTION public.validate_instore_ticket(TEXT, TEXT) TO authenticated;
