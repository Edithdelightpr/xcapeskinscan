DROP POLICY IF EXISTS "Outreach staff view outreach-captured clients" ON public.clients;
CREATE POLICY "Outreach staff view outreach-captured clients"
ON public.clients FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'outreach'::app_role)
  AND outreach_id IS NOT NULL
  AND (attributed_staff_id = auth.uid() OR origin_user_id = auth.uid())
);