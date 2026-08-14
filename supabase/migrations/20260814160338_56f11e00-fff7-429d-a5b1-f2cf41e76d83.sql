-- ============ 1. ORGANIZATIONS ============
CREATE TABLE IF NOT EXISTS public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  kind text NOT NULL DEFAULT 'cdp',
  status text NOT NULL DEFAULT 'pending',
  contact_email text,
  contact_phone text,
  location text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT organizations_kind_check CHECK (kind IN ('xcape_root','cdp')),
  CONSTRAINT organizations_status_check CHECK (status IN ('pending','active','suspended'))
);

GRANT SELECT, INSERT, UPDATE ON public.organizations TO authenticated;
GRANT ALL ON public.organizations TO service_role;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.organization_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  member_role text NOT NULL DEFAULT 'member',
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, user_id),
  CONSTRAINT organization_members_role_check CHECK (member_role IN ('owner','member')),
  CONSTRAINT organization_members_status_check CHECK (status IN ('pending','active','suspended'))
);

GRANT SELECT, INSERT, UPDATE ON public.organization_members TO authenticated;
GRANT ALL ON public.organization_members TO service_role;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.organization_product_prices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  price numeric NOT NULL CHECK (price >= 0),
  currency text NOT NULL DEFAULT 'NGN',
  active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, product_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.organization_product_prices TO authenticated;
GRANT ALL ON public.organization_product_prices TO service_role;
ALTER TABLE public.organization_product_prices ENABLE ROW LEVEL SECURITY;

-- ============ 2. HELPER FUNCTIONS ============
CREATE OR REPLACE FUNCTION public.xcape_root_org_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM public.organizations WHERE kind = 'xcape_root' ORDER BY created_at LIMIT 1;
$$;
REVOKE EXECUTE ON FUNCTION public.xcape_root_org_id() FROM anon;

CREATE OR REPLACE FUNCTION public.is_org_member(_org uuid, _user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members m
    WHERE m.organization_id = _org AND m.user_id = _user AND m.status = 'active'
  );
$$;
REVOKE EXECUTE ON FUNCTION public.is_org_member(uuid, uuid) FROM anon;

CREATE OR REPLACE FUNCTION public.user_org_ids(_user uuid)
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT m.organization_id FROM public.organization_members m
  WHERE m.user_id = _user AND m.status = 'active';
$$;
REVOKE EXECUTE ON FUNCTION public.user_org_ids(uuid) FROM anon;

CREATE OR REPLACE FUNCTION public.primary_org_id(_user uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT m.organization_id FROM public.organization_members m
  JOIN public.organizations o ON o.id = m.organization_id
  WHERE m.user_id = _user AND m.status = 'active'
  ORDER BY (o.kind = 'cdp') DESC, m.created_at
  LIMIT 1;
$$;
REVOKE EXECUTE ON FUNCTION public.primary_org_id(uuid) FROM anon;

-- Resolved commercial price for a product within an organization context.
CREATE OR REPLACE FUNCTION public.xcape_resolved_price(_org uuid, _product uuid)
RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(
    (SELECT opp.price FROM public.organization_product_prices opp
      JOIN public.organizations o ON o.id = opp.organization_id
      WHERE opp.organization_id = _org AND opp.product_id = _product
        AND opp.active AND o.kind = 'cdp'),
    (SELECT p.selling_price FROM public.products p WHERE p.id = _product)
  );
$$;
REVOKE EXECUTE ON FUNCTION public.xcape_resolved_price(uuid, uuid) FROM anon;

-- ============ 3. SEED THE ROOT ORGANIZATION ============
INSERT INTO public.organizations (name, slug, kind, status)
SELECT 'XCAPE', 'xcape', 'xcape_root', 'active'
WHERE NOT EXISTS (SELECT 1 FROM public.organizations WHERE kind = 'xcape_root');

-- ============ 4. ATTRIBUTION COLUMNS ============
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS origin_user_id uuid,
  ADD COLUMN IF NOT EXISTS origin_role text,
  ADD COLUMN IF NOT EXISTS origin_org_id uuid REFERENCES public.organizations(id);

ALTER TABLE public.client_visit_assessments
  ADD COLUMN IF NOT EXISTS origin_user_id uuid,
  ADD COLUMN IF NOT EXISTS origin_role text,
  ADD COLUMN IF NOT EXISTS origin_org_id uuid REFERENCES public.organizations(id);

ALTER TABLE public.client_report_links
  ADD COLUMN IF NOT EXISTS origin_org_id uuid REFERENCES public.organizations(id),
  ADD COLUMN IF NOT EXISTS open_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS first_opened_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_opened_at timestamptz;

ALTER TABLE public.pending_outreach_orders
  ADD COLUMN IF NOT EXISTS origin_user_id uuid,
  ADD COLUMN IF NOT EXISTS origin_role text,
  ADD COLUMN IF NOT EXISTS origin_org_id uuid REFERENCES public.organizations(id),
  ADD COLUMN IF NOT EXISTS fulfilment_org_id uuid REFERENCES public.organizations(id),
  ADD COLUMN IF NOT EXISTS report_link_id uuid REFERENCES public.client_report_links(id),
  ADD COLUMN IF NOT EXISTS price_snapshot jsonb;

CREATE INDEX IF NOT EXISTS clients_origin_user_idx ON public.clients(origin_user_id);
CREATE INDEX IF NOT EXISTS clients_origin_org_idx ON public.clients(origin_org_id);
CREATE INDEX IF NOT EXISTS cva_origin_user_idx ON public.client_visit_assessments(origin_user_id);
CREATE INDEX IF NOT EXISTS cva_origin_org_idx ON public.client_visit_assessments(origin_org_id);
CREATE INDEX IF NOT EXISTS poo_origin_user_idx ON public.pending_outreach_orders(origin_user_id);
CREATE INDEX IF NOT EXISTS poo_fulfilment_org_idx ON public.pending_outreach_orders(fulfilment_org_id);

-- ============ 5. ORIGIN STAMPING TRIGGER ============
CREATE OR REPLACE FUNCTION public.stamp_xcape_origin()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid uuid := auth.uid();
  org uuid;
  r text;
BEGIN
  IF uid IS NULL THEN RETURN NEW; END IF;
  IF NEW.origin_user_id IS NULL THEN NEW.origin_user_id := uid; END IF;
  IF NEW.origin_role IS NULL THEN
    SELECT ur.role::text INTO r FROM public.user_roles ur
    WHERE ur.user_id = uid
    ORDER BY CASE ur.role::text
      WHEN 'admin' THEN 1 WHEN 'cdp' THEN 2 WHEN 'affiliate' THEN 3 ELSE 4 END
    LIMIT 1;
    NEW.origin_role := r;
  END IF;
  IF NEW.origin_org_id IS NULL THEN
    org := public.primary_org_id(uid);
    NEW.origin_org_id := COALESCE(org, public.xcape_root_org_id());
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.stamp_xcape_origin() FROM anon;

DROP TRIGGER IF EXISTS stamp_origin_clients ON public.clients;
CREATE TRIGGER stamp_origin_clients BEFORE INSERT ON public.clients
FOR EACH ROW EXECUTE FUNCTION public.stamp_xcape_origin();

DROP TRIGGER IF EXISTS stamp_origin_assessments ON public.client_visit_assessments;
CREATE TRIGGER stamp_origin_assessments BEFORE INSERT ON public.client_visit_assessments
FOR EACH ROW EXECUTE FUNCTION public.stamp_xcape_origin();

DROP TRIGGER IF EXISTS stamp_origin_orders ON public.pending_outreach_orders;
CREATE TRIGGER stamp_origin_orders BEFORE INSERT ON public.pending_outreach_orders
FOR EACH ROW EXECUTE FUNCTION public.stamp_xcape_origin();

CREATE OR REPLACE FUNCTION public.stamp_order_fulfilment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE org_kind text;
BEGIN
  IF NEW.fulfilment_org_id IS NULL THEN
    SELECT kind INTO org_kind FROM public.organizations WHERE id = NEW.origin_org_id;
    -- Only CDP-originated orders are fulfilled by that CDP; everything else by XCAPE.
    IF org_kind = 'cdp' AND NEW.origin_role = 'cdp' THEN
      NEW.fulfilment_org_id := NEW.origin_org_id;
    ELSE
      NEW.fulfilment_org_id := public.xcape_root_org_id();
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.stamp_order_fulfilment() FROM anon;

DROP TRIGGER IF EXISTS stamp_fulfilment_orders ON public.pending_outreach_orders;
CREATE TRIGGER stamp_fulfilment_orders BEFORE INSERT ON public.pending_outreach_orders
FOR EACH ROW EXECUTE FUNCTION public.stamp_xcape_origin();

DROP TRIGGER IF EXISTS stamp_fulfilment_orders2 ON public.pending_outreach_orders;
CREATE TRIGGER stamp_fulfilment_orders2 BEFORE INSERT ON public.pending_outreach_orders
FOR EACH ROW EXECUTE FUNCTION public.stamp_order_fulfilment();

CREATE OR REPLACE FUNCTION public.touch_updated_at_generic()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS organizations_touch ON public.organizations;
CREATE TRIGGER organizations_touch BEFORE UPDATE ON public.organizations
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at_generic();

DROP TRIGGER IF EXISTS organization_members_touch ON public.organization_members;
CREATE TRIGGER organization_members_touch BEFORE UPDATE ON public.organization_members
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at_generic();

DROP TRIGGER IF EXISTS organization_prices_touch ON public.organization_product_prices;
CREATE TRIGGER organization_prices_touch BEFORE UPDATE ON public.organization_product_prices
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at_generic();

-- ============ 6. RLS POLICIES (NEW TABLES) ============
DROP POLICY IF EXISTS "orgs admin manage" ON public.organizations;
CREATE POLICY "orgs admin manage" ON public.organizations FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "orgs members read" ON public.organizations;
CREATE POLICY "orgs members read" ON public.organizations FOR SELECT TO authenticated
  USING (kind = 'xcape_root' OR public.is_org_member(id, auth.uid()));

DROP POLICY IF EXISTS "orgs owner update" ON public.organizations;
CREATE POLICY "orgs owner update" ON public.organizations FOR UPDATE TO authenticated
  USING (public.is_org_member(id, auth.uid()) AND kind = 'cdp')
  WITH CHECK (public.is_org_member(id, auth.uid()) AND kind = 'cdp');

DROP POLICY IF EXISTS "org members admin manage" ON public.organization_members;
CREATE POLICY "org members admin manage" ON public.organization_members FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "org members read own org" ON public.organization_members;
CREATE POLICY "org members read own org" ON public.organization_members FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_org_member(organization_id, auth.uid()));

DROP POLICY IF EXISTS "org prices admin manage" ON public.organization_product_prices;
CREATE POLICY "org prices admin manage" ON public.organization_product_prices FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "org prices member manage" ON public.organization_product_prices;
CREATE POLICY "org prices member manage" ON public.organization_product_prices FOR ALL TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()))
  WITH CHECK (public.is_org_member(organization_id, auth.uid()));

-- ============ 7. SCOPED ACCESS FOR AFFILIATE / CDP ============
DROP POLICY IF EXISTS "xcape partners read own clients" ON public.clients;
CREATE POLICY "xcape partners read own clients" ON public.clients FOR SELECT TO authenticated
  USING (
    origin_user_id = auth.uid()
    OR (origin_org_id IS NOT NULL AND public.is_org_member(origin_org_id, auth.uid()))
  );

DROP POLICY IF EXISTS "xcape partners create clients" ON public.clients;
CREATE POLICY "xcape partners create clients" ON public.clients FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'affiliate') OR public.has_role(auth.uid(), 'cdp')
  );

DROP POLICY IF EXISTS "xcape partners update own clients" ON public.clients;
CREATE POLICY "xcape partners update own clients" ON public.clients FOR UPDATE TO authenticated
  USING (origin_user_id = auth.uid() OR (origin_org_id IS NOT NULL AND public.is_org_member(origin_org_id, auth.uid())))
  WITH CHECK (origin_user_id = auth.uid() OR (origin_org_id IS NOT NULL AND public.is_org_member(origin_org_id, auth.uid())));

DROP POLICY IF EXISTS "xcape partners read own assessments" ON public.client_visit_assessments;
CREATE POLICY "xcape partners read own assessments" ON public.client_visit_assessments FOR SELECT TO authenticated
  USING (
    origin_user_id = auth.uid()
    OR (origin_org_id IS NOT NULL AND public.is_org_member(origin_org_id, auth.uid()))
  );

DROP POLICY IF EXISTS "xcape partners write own assessments" ON public.client_visit_assessments;
CREATE POLICY "xcape partners write own assessments" ON public.client_visit_assessments FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'affiliate') OR public.has_role(auth.uid(), 'cdp'));

DROP POLICY IF EXISTS "xcape partners update own assessments" ON public.client_visit_assessments;
CREATE POLICY "xcape partners update own assessments" ON public.client_visit_assessments FOR UPDATE TO authenticated
  USING (origin_user_id = auth.uid() OR (origin_org_id IS NOT NULL AND public.is_org_member(origin_org_id, auth.uid())))
  WITH CHECK (origin_user_id = auth.uid() OR (origin_org_id IS NOT NULL AND public.is_org_member(origin_org_id, auth.uid())));

DROP POLICY IF EXISTS "xcape partners read own report links" ON public.client_report_links;
CREATE POLICY "xcape partners read own report links" ON public.client_report_links FOR SELECT TO authenticated
  USING (
    created_by = auth.uid()
    OR (origin_org_id IS NOT NULL AND public.is_org_member(origin_org_id, auth.uid()))
  );

DROP POLICY IF EXISTS "xcape partners read own orders" ON public.pending_outreach_orders;
CREATE POLICY "xcape partners read own orders" ON public.pending_outreach_orders FOR SELECT TO authenticated
  USING (
    origin_user_id = auth.uid()
    OR (origin_org_id IS NOT NULL AND public.is_org_member(origin_org_id, auth.uid()))
    OR (fulfilment_org_id IS NOT NULL AND public.is_org_member(fulfilment_org_id, auth.uid()))
  );

-- ============ 8. SELF-SERVE ROLE CLAIM ============
CREATE OR REPLACE FUNCTION public.claim_xcape_account_role(_role text, _org_name text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid uuid := auth.uid();
  uemail text;
  uname text;
  new_org uuid;
  base_slug text;
  final_slug text;
  n int := 0;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF _role NOT IN ('affiliate','cdp') THEN RAISE EXCEPTION 'unsupported role'; END IF;

  IF EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = uid) THEN
    RETURN jsonb_build_object('claimed', false, 'reason', 'role_already_assigned');
  END IF;

  SELECT email, full_name INTO uemail, uname FROM public.staff_users WHERE id = uid;

  IF _role = 'affiliate' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (uid, 'affiliate'::public.app_role)
      ON CONFLICT DO NOTHING;
    UPDATE public.staff_users SET status = 'active', updated_at = now() WHERE id = uid;
    INSERT INTO public.organization_members (organization_id, user_id, member_role, status)
      VALUES (public.xcape_root_org_id(), uid, 'member', 'active')
      ON CONFLICT (organization_id, user_id) DO NOTHING;
    RETURN jsonb_build_object('claimed', true, 'role', 'affiliate', 'status', 'active');
  END IF;

  -- CDP: create a pending organization owned by this account.
  base_slug := public._slugify(COALESCE(NULLIF(trim(_org_name), ''), uname, split_part(COALESCE(uemail,'partner'),'@',1)));
  IF base_slug IS NULL OR base_slug = '' THEN base_slug := 'cdp'; END IF;
  final_slug := base_slug;
  WHILE EXISTS (SELECT 1 FROM public.organizations WHERE slug = final_slug) LOOP
    n := n + 1;
    final_slug := base_slug || '-' || n::text;
  END LOOP;

  INSERT INTO public.organizations (name, slug, kind, status, contact_email, created_by)
  VALUES (COALESCE(NULLIF(trim(_org_name), ''), uname, 'Partner Location'), final_slug, 'cdp', 'pending', uemail, uid)
  RETURNING id INTO new_org;

  INSERT INTO public.organization_members (organization_id, user_id, member_role, status)
  VALUES (new_org, uid, 'owner', 'active');

  INSERT INTO public.user_roles (user_id, role) VALUES (uid, 'cdp'::public.app_role)
    ON CONFLICT DO NOTHING;

  UPDATE public.staff_users SET status = 'invited', updated_at = now()
  WHERE id = uid AND status = 'inactive';

  RETURN jsonb_build_object('claimed', true, 'role', 'cdp', 'status', 'pending', 'organization_id', new_org);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.claim_xcape_account_role(text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.claim_xcape_account_role(text, text) TO authenticated;