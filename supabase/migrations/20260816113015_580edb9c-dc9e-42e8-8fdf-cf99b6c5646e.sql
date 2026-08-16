-- 1. Path parser: canonical client-media object key
--    clients/<client-id>/assessments/<assessment-id>/<category>/<file>
--    Malformed input returns NULL (never raises).
CREATE OR REPLACE FUNCTION public.xcape_media_path_parts(_name text)
RETURNS uuid[]
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $$
DECLARE
  parts text[];
  cid uuid;
  aid uuid;
BEGIN
  parts := string_to_array(COALESCE(_name, ''), '/');
  IF parts IS NULL OR array_length(parts, 1) < 6 THEN RETURN NULL; END IF;
  IF parts[1] <> 'clients' OR parts[3] <> 'assessments' THEN RETURN NULL; END IF;
  BEGIN
    cid := parts[2]::uuid;
    aid := parts[4]::uuid;
  EXCEPTION WHEN others THEN
    RETURN NULL;
  END;
  RETURN ARRAY[cid, aid];
END;
$$;

REVOKE ALL ON FUNCTION public.xcape_media_path_parts(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.xcape_media_path_parts(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.xcape_media_path_parts(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.xcape_media_path_parts(text) TO service_role;

-- 2. Assessment-scoped media authorization. Mirrors xcape_may_archive_client:
--    an XCAPE-root stamp is NOT a CDP origin.
CREATE OR REPLACE FUNCTION public.xcape_may_access_assessment_media(_assessment_id uuid, _actor uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  WITH scope AS (
    SELECT a.id, a.client_id, a.origin_user_id, a.origin_role, a.origin_org_id
    FROM public.client_visit_assessments a
    JOIN public.clients c ON c.id = a.client_id
    WHERE a.id = _assessment_id
      AND COALESCE(c.archived, false) = false
  ),
  cdp_orgs AS (
    SELECT DISTINCT o.id
    FROM public.organizations o
    WHERE o.kind = 'cdp'
      AND (
        o.id IN (SELECT s.origin_org_id FROM scope s WHERE s.origin_org_id IS NOT NULL)
        OR o.id IN (
          SELECT c.origin_org_id FROM public.clients c
          WHERE c.id IN (SELECT s.client_id FROM scope s) AND c.origin_org_id IS NOT NULL
        )
      )
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
            -- Real CDP context: active membership in an active CDP org is
            -- ALWAYS required; direct origin is never a bypass.
            WHEN EXISTS (SELECT 1 FROM cdp_orgs) OR s.origin_role = 'cdp' THEN EXISTS (
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
$$;

REVOKE ALL ON FUNCTION public.xcape_may_access_assessment_media(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.xcape_may_access_assessment_media(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.xcape_may_access_assessment_media(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.xcape_may_access_assessment_media(uuid, uuid) TO service_role;

-- 3. client_media partner policies (table stays otherwise unchanged)
DROP POLICY IF EXISTS "XCAPE partners read own assessment media" ON public.client_media;
CREATE POLICY "XCAPE partners read own assessment media"
ON public.client_media FOR SELECT TO authenticated
USING (
  COALESCE(archived, false) = false
  AND assessment_id IS NOT NULL
  AND public.xcape_may_access_assessment_media(assessment_id, auth.uid())
);

DROP POLICY IF EXISTS "XCAPE partners insert own assessment media" ON public.client_media;
CREATE POLICY "XCAPE partners insert own assessment media"
ON public.client_media FOR INSERT TO authenticated
WITH CHECK (
  uploaded_by = auth.uid()
  AND assessment_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.client_visit_assessments a
    WHERE a.id = client_media.assessment_id
      AND a.client_id = client_media.client_id
  )
  AND public.xcape_may_access_assessment_media(assessment_id, auth.uid())
);

DROP POLICY IF EXISTS "XCAPE partners delete own assessment media" ON public.client_media;
CREATE POLICY "XCAPE partners delete own assessment media"
ON public.client_media FOR DELETE TO authenticated
USING (
  uploaded_by = auth.uid()
  AND assessment_id IS NOT NULL
  AND public.xcape_may_access_assessment_media(assessment_id, auth.uid())
);

-- 4. Private storage policies for the client-media bucket
DROP POLICY IF EXISTS "XCAPE partners upload assessment media" ON storage.objects;
CREATE POLICY "XCAPE partners upload assessment media"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'client-media'
  AND owner = auth.uid()
  AND public.xcape_media_path_parts(name) IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.client_visit_assessments a
    WHERE a.id = (public.xcape_media_path_parts(name))[2]
      AND a.client_id = (public.xcape_media_path_parts(name))[1]
  )
  AND public.xcape_may_access_assessment_media(
    (public.xcape_media_path_parts(name))[2], auth.uid())
);

DROP POLICY IF EXISTS "XCAPE partners read assessment media files" ON storage.objects;
CREATE POLICY "XCAPE partners read assessment media files"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'client-media'
  AND EXISTS (
    SELECT 1 FROM public.client_media cm
    WHERE (cm.storage_path = storage.objects.name OR cm.bucket_path = storage.objects.name)
      AND COALESCE(cm.archived, false) = false
      AND cm.assessment_id IS NOT NULL
      AND public.xcape_may_access_assessment_media(cm.assessment_id, auth.uid())
  )
);

-- Path-based (not metadata-based) so the hook's "delete row, then delete
-- file" order can never orphan the object.
DROP POLICY IF EXISTS "XCAPE partners delete own assessment media files" ON storage.objects;
CREATE POLICY "XCAPE partners delete own assessment media files"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'client-media'
  AND owner = auth.uid()
  AND public.xcape_media_path_parts(name) IS NOT NULL
  AND public.xcape_may_access_assessment_media(
    (public.xcape_media_path_parts(name))[2], auth.uid())
);