CREATE OR REPLACE FUNCTION public.xcape_may_archive_client(_client_id uuid, _actor uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  WITH scope AS (
    SELECT
      c.id AS client_id,
      c.origin_user_id AS client_owner,
      EXISTS (
        SELECT 1 FROM public.client_visit_assessments a
        WHERE a.client_id = c.id AND a.origin_user_id = _actor
      ) AS assessed_by_actor
    FROM public.clients c
    WHERE c.id = _client_id
  ),
  cdp_orgs AS (
    -- Only organizations that are ACTUALLY CDP locations count. An XCAPE root
    -- stamp on an Affiliate client is not a CDP origin.
    SELECT DISTINCT o.id
    FROM public.organizations o
    WHERE o.kind = 'cdp'
      AND (
        o.id IN (SELECT c.origin_org_id FROM public.clients c WHERE c.id = _client_id)
        OR o.id IN (
          SELECT a.origin_org_id FROM public.client_visit_assessments a
          WHERE a.client_id = _client_id AND a.origin_org_id IS NOT NULL
        )
      )
  )
  SELECT
    CASE
      WHEN _client_id IS NULL OR _actor IS NULL THEN false
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
            -- Real CDP location involved: ALWAYS require an active membership
            -- in an active relevant CDP organization. Direct origin is not a
            -- bypass.
            WHEN EXISTS (SELECT 1 FROM cdp_orgs) THEN EXISTS (
              SELECT 1
              FROM public.organization_members m
              JOIN public.organizations o ON o.id = m.organization_id
              WHERE m.organization_id IN (SELECT id FROM cdp_orgs)
                AND m.user_id = _actor
                AND m.status = 'active'
                AND o.kind = 'cdp'
                AND o.status = 'active'
            )
            -- No CDP location (includes XCAPE-root-stamped Affiliate clients):
            -- only the originator of the client or of one of its analyses.
            ELSE s.client_owner = _actor OR s.assessed_by_actor
          END
        FROM scope s
      ), false)
    END;
$$;

REVOKE EXECUTE ON FUNCTION public.xcape_may_archive_client(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.xcape_may_archive_client(uuid, uuid) TO service_role;