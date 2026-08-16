-- 1. Cleanup audit columns on clients (no secrets stored).
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS archived_by uuid,
  ADD COLUMN IF NOT EXISTS media_purge_status text,
  ADD COLUMN IF NOT EXISTS media_purged_at timestamptz,
  ADD COLUMN IF NOT EXISTS media_purge_error text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'clients_media_purge_status_check'
  ) THEN
    ALTER TABLE public.clients
      ADD CONSTRAINT clients_media_purge_status_check
      CHECK (media_purge_status IS NULL
             OR media_purge_status IN ('pending', 'complete', 'error'));
  END IF;
END $$;

-- 2. Pure authorization predicate, reused by the archive routine.
--    SECURITY DEFINER so it can read user_roles / organizations regardless of
--    the calling role, with an empty search_path and fully-qualified objects.
CREATE OR REPLACE FUNCTION public.xcape_may_archive_client(_client_id uuid, _actor uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    CASE
      WHEN _client_id IS NULL OR _actor IS NULL THEN false
      -- XCAPE admin may archive any client.
      WHEN EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = _actor AND ur.role = 'admin'::public.app_role
      ) THEN true
      -- Otherwise the caller must hold a partner role ...
      WHEN NOT EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = _actor
          AND ur.role IN ('affiliate'::public.app_role, 'cdp'::public.app_role)
      ) THEN false
      -- ... AND own the client directly, or manage it through an ACTIVE CDP
      -- organization in which they are an ACTIVE member.
      ELSE EXISTS (
        SELECT 1 FROM public.clients c
        WHERE c.id = _client_id
          AND (
            c.origin_user_id = _actor
            OR (
              c.origin_org_id IS NOT NULL
              AND EXISTS (
                SELECT 1
                FROM public.organization_members m
                JOIN public.organizations o ON o.id = m.organization_id
                WHERE m.organization_id = c.origin_org_id
                  AND m.user_id = _actor
                  AND m.status = 'active'
                  AND o.kind = 'cdp'
                  AND o.status = 'active'
              )
            )
          )
      )
      OR EXISTS (
        SELECT 1 FROM public.client_visit_assessments a
        WHERE a.client_id = _client_id
          AND (
            a.origin_user_id = _actor
            OR (
              a.origin_org_id IS NOT NULL
              AND EXISTS (
                SELECT 1
                FROM public.organization_members m
                JOIN public.organizations o ON o.id = m.organization_id
                WHERE m.organization_id = a.origin_org_id
                  AND m.user_id = _actor
                  AND m.status = 'active'
                  AND o.kind = 'cdp'
                  AND o.status = 'active'
              )
            )
          )
      )
    END;
$$;

REVOKE EXECUTE ON FUNCTION public.xcape_may_archive_client(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.xcape_may_archive_client(uuid, uuid) TO service_role;

-- 3. Transactional archive routine. Executed by service_role from the trusted
--    edge function only, so SECURITY INVOKER is sufficient (service_role
--    bypasses RLS); the authorization re-check happens inside.
CREATE OR REPLACE FUNCTION public.xcape_archive_client(_client_id uuid, _actor uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_client public.clients%ROWTYPE;
  v_paths text[];
  v_links integer := 0;
  v_media integer := 0;
  v_already boolean := false;
BEGIN
  IF _client_id IS NULL OR _actor IS NULL THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;

  -- Lock the client row for the duration of the transaction.
  SELECT * INTO v_client FROM public.clients WHERE id = _client_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
  END IF;

  IF NOT public.xcape_may_archive_client(_client_id, _actor) THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;

  v_already := COALESCE(v_client.archived, false);

  -- Revoke every currently active report link for this client.
  WITH revoked AS (
    UPDATE public.client_report_links
       SET revoked_at = now(), updated_at = now()
     WHERE client_id = _client_id
       AND revoked_at IS NULL
    RETURNING 1
  )
  SELECT count(*) INTO v_links FROM revoked;

  -- Archive every media row (idempotent).
  WITH arch AS (
    UPDATE public.client_media
       SET archived = true,
           archived_at = COALESCE(archived_at, now())
     WHERE client_id = _client_id
       AND archived = false
    RETURNING 1
  )
  SELECT count(*) INTO v_media FROM arch;

  -- Storage objects still to remove (returned to the trusted caller only).
  SELECT COALESCE(array_agg(DISTINCT p), '{}'::text[])
    INTO v_paths
    FROM (
      SELECT COALESCE(m.storage_path, m.bucket_path) AS p
        FROM public.client_media m
       WHERE m.client_id = _client_id
    ) s
   WHERE p IS NOT NULL AND length(p) > 0;

  UPDATE public.clients
     SET archived = true,
         archived_at = COALESCE(archived_at, now()),
         archived_by = COALESCE(archived_by, _actor),
         media_purge_status = CASE
           WHEN COALESCE(array_length(v_paths, 1), 0) = 0 THEN 'complete'
           ELSE 'pending'
         END,
         media_purged_at = CASE
           WHEN COALESCE(array_length(v_paths, 1), 0) = 0 THEN now()
           ELSE media_purged_at
         END,
         media_purge_error = NULL,
         updated_at = now()
   WHERE id = _client_id;

  RETURN jsonb_build_object(
    'client_id', _client_id,
    'already_archived', v_already,
    'links_revoked', v_links,
    'media_archived', v_media,
    'storage_paths', to_jsonb(v_paths)
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.xcape_archive_client(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.xcape_archive_client(uuid, uuid) TO service_role;

-- 4. Record the outcome of the storage purge (sanitized message only).
CREATE OR REPLACE FUNCTION public.xcape_mark_client_media_purged(
  _client_id uuid,
  _status text,
  _error text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF _client_id IS NULL OR _status NOT IN ('pending', 'complete', 'error') THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;

  UPDATE public.clients
     SET media_purge_status = _status,
         media_purged_at = CASE WHEN _status = 'complete' THEN now() ELSE media_purged_at END,
         media_purge_error = CASE WHEN _status = 'error' THEN left(COALESCE(_error, 'cleanup failed'), 200) ELSE NULL END,
         updated_at = now()
   WHERE id = _client_id
     AND archived = true;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.xcape_mark_client_media_purged(uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.xcape_mark_client_media_purged(uuid, text, text) TO service_role;