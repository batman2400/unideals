-- Update get_partner_deal_stats to include start_time and end_time
DROP FUNCTION IF EXISTS public.get_partner_deal_stats(uuid);

CREATE OR REPLACE FUNCTION public.get_partner_deal_stats(target_partner_id UUID DEFAULT auth.uid())
RETURNS TABLE (
  deal_id BIGINT,
  deal_title TEXT,
  deal_type TEXT,
  deal_status TEXT,
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
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
DECLARE
  target_brand_id UUID;
BEGIN
  -- Only the partner themselves or an admin can call this
  IF auth.uid() <> target_partner_id AND public.get_user_role() <> 'admin' THEN
    RAISE EXCEPTION 'Access denied.'
      USING ERRCODE = '42501';
  END IF;

  target_brand_id := public.get_partner_brand_id(target_partner_id);

  RETURN QUERY
  SELECT
    d.id AS deal_id,
    d.title AS deal_title,
    d.type AS deal_type,
    d.status::text AS deal_status,
    d.start_time,
    d.end_time,
    COALESCE((SELECT COUNT(*) FROM public.online_code_events oce WHERE oce.deal_id = d.id AND oce.event_type = 'reveal'), 0)::BIGINT,
    COALESCE((SELECT COUNT(*) FROM public.online_code_events oce WHERE oce.deal_id = d.id AND oce.event_type = 'copy'), 0)::BIGINT,
    COALESCE((SELECT COUNT(*) FROM public.online_code_events oce WHERE oce.deal_id = d.id AND oce.event_type = 'click_through'), 0)::BIGINT,
    COALESCE((SELECT COUNT(*) FROM public.student_redemption_tickets srt WHERE srt.deal_id = d.id), 0)::BIGINT,
    COALESCE((SELECT COUNT(*) FROM public.student_redemption_tickets srt WHERE srt.deal_id = d.id AND srt.redeemed_at IS NOT NULL), 0)::BIGINT,
    COALESCE((SELECT COUNT(*) FROM public.redemption_events re WHERE re.deal_id = d.id), 0)::BIGINT,
    COALESCE((SELECT COUNT(*) FROM public.confirmed_redemptions cr WHERE cr.deal_id = d.id), 0)::BIGINT
  FROM public.deals d
  WHERE d.brand_id = target_brand_id
  ORDER BY d.created_at DESC;
END
$$;
