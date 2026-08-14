-- Canonical phone key: digits only, last 10 — matches the app's dedupe rule.
CREATE OR REPLACE FUNCTION public.xcape_normalise_phone(_raw text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT right(regexp_replace(coalesce(_raw, ''), '\D', '', 'g'), 10);
$$;

CREATE INDEX IF NOT EXISTS clients_phone_key_idx
  ON public.clients (public.xcape_normalise_phone(phone))
  WHERE phone IS NOT NULL;

-- A person is permanent; the operator who touched them is an event.
-- Anyone who ran an analysis, shared a report or took an order for a client
-- keeps read/update access to that client's identity record afterwards.
CREATE OR REPLACE FUNCTION public.has_client_touchpoint(_client uuid, _user uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.client_visit_assessments a
    WHERE a.client_id = _client
      AND (a.origin_user_id = _user
           OR (a.origin_org_id IS NOT NULL AND public.can_read_org_scope(a.origin_org_id, _user)))
  ) OR EXISTS (
    SELECT 1 FROM public.client_report_links l
    WHERE l.client_id = _client
      AND (l.created_by = _user
           OR (l.origin_org_id IS NOT NULL AND public.can_read_org_scope(l.origin_org_id, _user)))
  ) OR EXISTS (
    SELECT 1 FROM public.pending_outreach_orders o
    WHERE o.customer_client_id = _client
      AND (o.origin_user_id = _user
           OR (o.fulfilment_org_id IS NOT NULL AND public.can_read_org_scope(o.fulfilment_org_id, _user)))
  );
$$;
REVOKE EXECUTE ON FUNCTION public.has_client_touchpoint(uuid, uuid) FROM anon;

DROP POLICY IF EXISTS "xcape partners read own clients" ON public.clients;
CREATE POLICY "xcape partners read own clients" ON public.clients
FOR SELECT TO authenticated
USING (origin_user_id = auth.uid()
       OR (origin_org_id IS NOT NULL AND public.can_read_org_scope(origin_org_id, auth.uid()))
       OR public.has_client_touchpoint(id, auth.uid()));

DROP POLICY IF EXISTS "xcape partners update own clients" ON public.clients;
CREATE POLICY "xcape partners update own clients" ON public.clients
FOR UPDATE TO authenticated
USING (origin_user_id = auth.uid()
       OR (origin_org_id IS NOT NULL AND public.can_read_org_scope(origin_org_id, auth.uid()))
       OR public.has_client_touchpoint(id, auth.uid()))
WITH CHECK (origin_user_id = auth.uid()
       OR (origin_org_id IS NOT NULL AND public.can_read_org_scope(origin_org_id, auth.uid()))
       OR public.has_client_touchpoint(id, auth.uid()));

-- Cross-operator identity lookup. Deliberately minimal: enough to recognise
-- and reuse the same person, never enough to read their history.
CREATE OR REPLACE FUNCTION public.xcape_lookup_client_by_phone(_phone text)
RETURNS TABLE (
  id uuid,
  full_name text,
  phone_masked text,
  created_at timestamptz,
  assessment_count integer,
  already_accessible boolean
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_key text := public.xcape_normalise_phone(_phone);
BEGIN
  IF auth.uid() IS NULL OR length(v_key) < 7 THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT c.id,
         c.full_name,
         '••• ' || right(v_key, 4) AS phone_masked,
         c.created_at,
         (SELECT count(*)::int FROM public.client_visit_assessments a WHERE a.client_id = c.id),
         (c.origin_user_id = auth.uid()
          OR (c.origin_org_id IS NOT NULL AND public.can_read_org_scope(c.origin_org_id, auth.uid()))
          OR public.has_client_touchpoint(c.id, auth.uid()))
  FROM public.clients c
  WHERE c.phone IS NOT NULL
    AND public.xcape_normalise_phone(c.phone) = v_key
  ORDER BY c.created_at
  LIMIT 5;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.xcape_lookup_client_by_phone(text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.xcape_lookup_client_by_phone(text) TO authenticated;

-- Membership lists stay inside partner locations; the shared XCAPE root org
-- must not expose every affiliate account to every other affiliate.
DROP POLICY IF EXISTS "org members read own org" ON public.organization_members;
CREATE POLICY "org members read own org" ON public.organization_members
FOR SELECT TO authenticated
USING (user_id = auth.uid()
       OR public.can_read_org_scope(organization_id, auth.uid())
       OR public.has_role(auth.uid(), 'admin'::public.app_role));