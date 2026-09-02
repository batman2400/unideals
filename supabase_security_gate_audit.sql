-- Uni Deals — SECURITY.md gate audit
-- Run in the production SQL editor (postgres). This inspects policies
-- and grants. It does not impersonate a student JWT.

SELECT check_name, ok, detail
FROM (
  SELECT
    '1_id_bucket_private' AS check_name,
    COALESCE((SELECT NOT public FROM storage.buckets WHERE id = 'verification-documents'), FALSE) AS ok,
    COALESCE((SELECT CASE WHEN public THEN 'public=true (BAD)' ELSE 'public=false' END
              FROM storage.buckets WHERE id = 'verification-documents'), 'bucket missing') AS detail

  UNION ALL
  SELECT
    '2_anon_cannot_select_deals',
    NOT has_table_privilege('anon', 'public.deals', 'SELECT'),
    CASE WHEN has_table_privilege('anon', 'public.deals', 'SELECT')
         THEN 'anon still has SELECT on deals'
         ELSE 'anon SELECT revoked' END

  UNION ALL
  SELECT
    '3_no_public_true_deal_select_policy',
    NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'deals' AND cmd = 'SELECT'
        AND (qual IS NULL OR btrim(qual) IN ('true', '(true)'))
    ),
    COALESCE(
      (SELECT string_agg(policyname, ', ')
       FROM pg_policies
       WHERE schemaname = 'public' AND tablename = 'deals' AND cmd = 'SELECT'),
      'no SELECT policies'
    )

  UNION ALL
  SELECT
    '4_id_upload_own_folder_only',
    EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'storage' AND tablename = 'objects'
        AND policyname = 'Users upload own verification documents'
    ),
    COALESCE(
      (SELECT string_agg(policyname, ', ' ORDER BY policyname)
       FROM pg_policies
       WHERE schemaname = 'storage' AND tablename = 'objects'
         AND (
           policyname ILIKE '%verification%'
           OR COALESCE(qual, '') ILIKE '%verification-documents%'
           OR COALESCE(with_check, '') ILIKE '%verification-documents%'
         )),
      'no verification storage policies'
    )

  UNION ALL
  SELECT
    '5_no_public_id_read_policy',
    NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'storage' AND tablename = 'objects'
        AND policyname ILIKE '%public%verification%'
    ),
    CASE WHEN EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'storage' AND tablename = 'objects'
        AND policyname ILIKE '%public%verification%'
    ) THEN 'public ID read policy still present' ELSE 'no public ID read policy' END

  UNION ALL
  SELECT
    '6_tickets_student_own_only',
    EXISTS (
      SELECT 1 FROM pg_policies
      WHERE tablename = 'student_redemption_tickets'
        AND policyname = 'Students can read own tickets'
    ),
    COALESCE(
      (SELECT string_agg(policyname, ', ')
       FROM pg_policies
       WHERE tablename = 'student_redemption_tickets' AND cmd = 'SELECT'),
      'no ticket SELECT policies'
    )

  UNION ALL
  SELECT
    '7_user_roles_students_cannot_update',
    NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'user_roles'
        AND cmd IN ('UPDATE', '*')
        AND NOT (
          (COALESCE(qual, '') ILIKE '%get_user_role%' AND COALESCE(qual, '') ILIKE '%admin%')
          OR (COALESCE(with_check, '') ILIKE '%get_user_role%' AND COALESCE(with_check, '') ILIKE '%admin%')
        )
    ),
    COALESCE(
      (SELECT string_agg(policyname || ':' || cmd || ':' || COALESCE(qual, '-'), ' | ')
       FROM pg_policies
       WHERE schemaname = 'public' AND tablename = 'user_roles'),
      'no user_roles policies'
    )

  UNION ALL
  SELECT
    '8_admin_rpcs_exist',
    EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'list_users_with_roles')
      AND EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'validate_instore_ticket')
      AND EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'approve_manual_verification')
      AND EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'reveal_online_deal_code'),
    (
      SELECT string_agg(proname, ', ' ORDER BY proname)
      FROM pg_proc
      WHERE proname IN (
        'list_users_with_roles',
        'admin_list_all_deals',
        'validate_instore_ticket',
        'approve_manual_verification',
        'reject_manual_verification',
        'reveal_online_deal_code'
      )
    )

  UNION ALL
  SELECT
    '9_validate_ticket_checks_partner',
    EXISTS (
      SELECT 1 FROM pg_proc
      WHERE proname = 'validate_instore_ticket'
        AND pg_get_functiondef(oid) ILIKE '%partner%'
    ),
    CASE
      WHEN EXISTS (
        SELECT 1 FROM pg_proc
        WHERE proname = 'validate_instore_ticket'
          AND pg_get_functiondef(oid) ILIKE '%partner%'
      ) THEN 'function gates on partner role'
      ELSE 'inspect function body'
    END

  UNION ALL
  SELECT
    '10_list_users_admin_gated',
    EXISTS (
      SELECT 1 FROM pg_proc
      WHERE proname = 'list_users_with_roles'
        AND pg_get_functiondef(oid) ILIKE '%admin%'
    ),
    CASE
      WHEN EXISTS (
        SELECT 1 FROM pg_proc
        WHERE proname = 'list_users_with_roles'
          AND pg_get_functiondef(oid) ILIKE '%admin%'
      ) THEN 'function mentions admin gate'
      ELSE 'no admin check found'
    END
) AS audit
ORDER BY check_name;
