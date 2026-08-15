DROP POLICY IF EXISTS "xcape partners create clients" ON public.clients;
CREATE POLICY "xcape partners create clients"
ON public.clients FOR INSERT TO authenticated
WITH CHECK (
  (has_role(auth.uid(), 'affiliate'::app_role) OR has_role(auth.uid(), 'cdp'::app_role))
  AND (origin_user_id IS NULL OR origin_user_id = auth.uid())
  AND (origin_org_id IS NULL OR can_read_org_scope(origin_org_id, auth.uid()))
);

DROP POLICY IF EXISTS "xcape partners write own assessments" ON public.client_visit_assessments;
CREATE POLICY "xcape partners write own assessments"
ON public.client_visit_assessments FOR INSERT TO authenticated
WITH CHECK (
  (has_role(auth.uid(), 'affiliate'::app_role) OR has_role(auth.uid(), 'cdp'::app_role))
  AND (origin_user_id IS NULL OR origin_user_id = auth.uid())
  AND (origin_org_id IS NULL OR can_read_org_scope(origin_org_id, auth.uid()))
);