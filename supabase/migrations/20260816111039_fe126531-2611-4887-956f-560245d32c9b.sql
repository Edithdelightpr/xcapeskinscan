CREATE OR REPLACE FUNCTION public.xcape_may_archive_client(_client_id uuid, _actor uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  WITH scope AS (
    SELECT
      c.origin_user_id AS client_owner,
      COALESCE(
        c.origin_org_id,
        (SELECT a.origin_org_id
           FROM public.client_visit_assessments a
          WHERE a.client_id = c.id
            AND a.origin_org_id IS NOT NULL
          ORDER BY a.created_at
          LIMIT 1)
      ) AS org_id,
      EXISTS (
        SELECT 1 FROM public.client_visit_assessments a
        WHERE a.client_id = c.id AND a.origin_user_id = _actor
      ) AS assessed_by_actor
    FROM public.clients c
    WHERE c.id = _client_id
  )
  SELECT
    CASE
      WHEN _client_id IS NULL OR _actor IS NULL THEN false
      -- XCAPE admin may archive any client.
      WHEN EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = _actor AND ur.role = 'admin'::public.app_role
      ) THEN true
      -- Otherwise the caller must hold a partner role.
      WHEN NOT EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = _actor
          AND ur.role IN ('affiliate'::public.app_role, 'cdp'::public.app_role)
      ) THEN false
      ELSE COALESCE((
        SELECT
          CASE
            -- Client belongs to a CDP location: ALWAYS require an active
            -- organization AND an active membership. Direct origin alone is
            -- not a shortcut past a suspended/pending org or member.
            WHEN s.org_id IS NOT NULL THEN EXISTS (
              SELECT 1
              FROM public.organization_members m
              JOIN public.organizations o ON o.id = m.organization_id
              WHERE m.organization_id = s.org_id
                AND m.user_id = _actor
                AND m.status = 'active'
                AND o.kind = 'cdp'
                AND o.status = 'active'
            )
            -- No partner location attached (Affiliate case): the originator
            -- of the client or of one of its analyses may remove it.
            ELSE s.client_owner = _actor OR s.assessed_by_actor
          END
        FROM scope s
      ), false)
    END;
$$;

REVOKE EXECUTE ON FUNCTION public.xcape_may_archive_client(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.xcape_may_archive_client(uuid, uuid) TO service_role;