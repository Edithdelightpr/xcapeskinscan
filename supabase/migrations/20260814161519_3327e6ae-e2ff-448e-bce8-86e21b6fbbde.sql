-- 1) Org-scope read helper: ONLY partner locations (CDP) share records across
-- their members. The XCAPE root org is shared by every affiliate, so root
-- membership must never grant cross-account visibility.
CREATE OR REPLACE FUNCTION public.can_read_org_scope(_org uuid, _user uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_members m
    JOIN public.organizations o ON o.id = m.organization_id
    WHERE m.organization_id = _org
      AND m.user_id = _user
      AND m.status = 'active'
      AND o.kind = 'cdp'
  );
$$;
REVOKE EXECUTE ON FUNCTION public.can_read_org_scope(uuid, uuid) FROM anon;

CREATE OR REPLACE FUNCTION public.can_manage_org_pricing(_org uuid, _user uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_members m
    JOIN public.organizations o ON o.id = m.organization_id
    WHERE m.organization_id = _org
      AND m.user_id = _user
      AND m.status = 'active'
      AND m.member_role IN ('owner','manager')
      AND o.kind = 'cdp'
  );
$$;
REVOKE EXECUTE ON FUNCTION public.can_manage_org_pricing(uuid, uuid) FROM anon;

-- 2) Re-scope the partner policies added for affiliates/CDPs.
DROP POLICY IF EXISTS "xcape partners read own clients" ON public.clients;
CREATE POLICY "xcape partners read own clients" ON public.clients
FOR SELECT TO authenticated
USING (origin_user_id = auth.uid()
       OR (origin_org_id IS NOT NULL AND public.can_read_org_scope(origin_org_id, auth.uid())));

DROP POLICY IF EXISTS "xcape partners update own clients" ON public.clients;
CREATE POLICY "xcape partners update own clients" ON public.clients
FOR UPDATE TO authenticated
USING (origin_user_id = auth.uid()
       OR (origin_org_id IS NOT NULL AND public.can_read_org_scope(origin_org_id, auth.uid())))
WITH CHECK (origin_user_id = auth.uid()
       OR (origin_org_id IS NOT NULL AND public.can_read_org_scope(origin_org_id, auth.uid())));

DROP POLICY IF EXISTS "xcape partners read own assessments" ON public.client_visit_assessments;
CREATE POLICY "xcape partners read own assessments" ON public.client_visit_assessments
FOR SELECT TO authenticated
USING (origin_user_id = auth.uid()
       OR (origin_org_id IS NOT NULL AND public.can_read_org_scope(origin_org_id, auth.uid())));

DROP POLICY IF EXISTS "xcape partners update own assessments" ON public.client_visit_assessments;
CREATE POLICY "xcape partners update own assessments" ON public.client_visit_assessments
FOR UPDATE TO authenticated
USING (origin_user_id = auth.uid()
       OR (origin_org_id IS NOT NULL AND public.can_read_org_scope(origin_org_id, auth.uid())))
WITH CHECK (origin_user_id = auth.uid()
       OR (origin_org_id IS NOT NULL AND public.can_read_org_scope(origin_org_id, auth.uid())));

DROP POLICY IF EXISTS "xcape partners read own report links" ON public.client_report_links;
CREATE POLICY "xcape partners read own report links" ON public.client_report_links
FOR SELECT TO authenticated
USING (created_by = auth.uid()
       OR (origin_org_id IS NOT NULL AND public.can_read_org_scope(origin_org_id, auth.uid())));

DROP POLICY IF EXISTS "xcape partners read own orders" ON public.pending_outreach_orders;
CREATE POLICY "xcape partners read own orders" ON public.pending_outreach_orders
FOR SELECT TO authenticated
USING (origin_user_id = auth.uid()
       OR (origin_org_id IS NOT NULL AND public.can_read_org_scope(origin_org_id, auth.uid()))
       OR (fulfilment_org_id IS NOT NULL AND public.can_read_org_scope(fulfilment_org_id, auth.uid())));

DROP POLICY IF EXISTS "org prices member manage" ON public.organization_product_prices;
CREATE POLICY "org prices partner manage" ON public.organization_product_prices
FOR ALL TO authenticated
USING (public.can_manage_org_pricing(organization_id, auth.uid()))
WITH CHECK (public.can_manage_org_pricing(organization_id, auth.uid()));

-- Everyone signed in may READ the price book of an org they belong to
-- (needed to render their own report pricing) without being able to edit it.
DROP POLICY IF EXISTS "org prices member read" ON public.organization_product_prices;
CREATE POLICY "org prices member read" ON public.organization_product_prices
FOR SELECT TO authenticated
USING (public.is_org_member(organization_id, auth.uid())
       OR public.has_role(auth.uid(), 'admin'::public.app_role));

-- 3) Commercial routing: stamp seller + immutable price snapshot on orders.
CREATE OR REPLACE FUNCTION public.stamp_order_commercial_context()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_kind text;
BEGIN
  IF NEW.fulfilment_org_id IS NULL THEN
    SELECT o.kind INTO v_kind FROM public.organizations o WHERE o.id = NEW.origin_org_id;
    -- A partner location sells and fulfils its own orders; every other origin
    -- (affiliate, admin, staff, unattributed) belongs to XCAPE.
    IF v_kind = 'cdp' THEN
      NEW.fulfilment_org_id := NEW.origin_org_id;
    ELSE
      NEW.fulfilment_org_id := public.xcape_root_org_id();
    END IF;
  END IF;

  IF NEW.price_snapshot IS NULL THEN
    NEW.price_snapshot := jsonb_build_object(
      'product_id', NEW.product_id,
      'unit_price', NEW.unit_price,
      'quantity', NEW.quantity,
      'currency', 'NGN',
      'price_source', CASE WHEN v_kind = 'cdp' THEN 'cdp' ELSE 'xcape' END,
      'merchant_org_id', NEW.fulfilment_org_id,
      'captured_at', now()
    );
  END IF;

  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.stamp_order_commercial_context() FROM anon, authenticated;

DROP TRIGGER IF EXISTS trg_stamp_order_commercial_context ON public.pending_outreach_orders;
CREATE TRIGGER trg_stamp_order_commercial_context
BEFORE INSERT ON public.pending_outreach_orders
FOR EACH ROW EXECUTE FUNCTION public.stamp_order_commercial_context();

-- 4) Historical orders are immutable commercially: the captured price snapshot
-- and the seller can never be rewritten by a later price change.
CREATE OR REPLACE FUNCTION public.guard_order_price_snapshot()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF OLD.price_snapshot IS NOT NULL AND NEW.price_snapshot IS DISTINCT FROM OLD.price_snapshot THEN
    NEW.price_snapshot := OLD.price_snapshot;
  END IF;
  IF OLD.fulfilment_org_id IS NOT NULL THEN
    NEW.fulfilment_org_id := OLD.fulfilment_org_id;
  END IF;
  IF OLD.unit_price IS NOT NULL THEN
    NEW.unit_price := OLD.unit_price;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.guard_order_price_snapshot() FROM anon, authenticated;

DROP TRIGGER IF EXISTS trg_guard_order_price_snapshot ON public.pending_outreach_orders;
CREATE TRIGGER trg_guard_order_price_snapshot
BEFORE UPDATE ON public.pending_outreach_orders
FOR EACH ROW EXECUTE FUNCTION public.guard_order_price_snapshot();

-- 5) Backfill routing for existing orders so fulfilment queues are complete.
UPDATE public.pending_outreach_orders p
SET fulfilment_org_id = COALESCE(
  (SELECT o.id FROM public.organizations o WHERE o.id = p.origin_org_id AND o.kind = 'cdp'),
  public.xcape_root_org_id()
)
WHERE p.fulfilment_org_id IS NULL;