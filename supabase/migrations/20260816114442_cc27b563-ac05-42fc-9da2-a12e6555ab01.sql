CREATE OR REPLACE FUNCTION public.xcape_may_access_assessment_media(_assessment_id uuid, _actor uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  WITH scope AS (
    -- The parent client is checked ONLY for existence / not-archived. It never
    -- changes the merchant scope of the assessment.
    SELECT a.id, a.client_id, a.origin_user_id, a.origin_role, a.origin_org_id
    FROM public.client_visit_assessments a
    JOIN public.clients c ON c.id = a.client_id
    WHERE a.id = _assessment_id
      AND COALESCE(c.archived, false) = false
  ),
  cdp_orgs AS (
    -- CDP scope comes from the ASSESSMENT's own origin org only.
    SELECT o.id
    FROM public.organizations o
    JOIN scope s ON s.origin_org_id = o.id
    WHERE o.kind = 'cdp'
  )
  SELECT
    CASE
      WHEN _assessment_id IS NULL OR _actor IS NULL THEN false
      WHEN NOT EXISTS (SELECT 1 FROM scope) THEN false
      WHEN EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = _actor AND ur.role = 'admin'::public.app_role
      ) THEN true
      WHEN NOT EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = _actor
          AND ur.role IN ('affiliate'::public.app_role, 'cdp'::public.app_role)
      ) THEN false
      ELSE COALESCE((
        SELECT
          CASE
            -- CDP assessment: active membership in the assessment's own active
            -- CDP org is ALWAYS required; direct origin is never a bypass, and
            -- a 'cdp' origin_role with no valid CDP org fails closed.
            WHEN s.origin_role = 'cdp' OR EXISTS (SELECT 1 FROM cdp_orgs) THEN EXISTS (
              SELECT 1
              FROM public.organization_members m
              JOIN public.organizations o ON o.id = m.organization_id
              WHERE m.organization_id IN (SELECT id FROM cdp_orgs)
                AND m.user_id = _actor
                AND m.status = 'active'
                AND o.kind = 'cdp'
                AND o.status = 'active'
            )
            -- Affiliate / XCAPE-root-stamped analysis: originator only.
            ELSE s.origin_user_id = _actor
          END
        FROM scope s
      ), false)
    END;
$function$;

REVOKE EXECUTE ON FUNCTION public.xcape_may_access_assessment_media(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.xcape_may_access_assessment_media(uuid, uuid) TO authenticated, service_role;