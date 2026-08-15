-- ============================================================
-- 1. Configurable admin settings
-- ============================================================
INSERT INTO public.site_settings (key, value)
VALUES
  ('xcape_authorization', jsonb_build_object('cdp_required_fee', 50000, 'currency', 'NGN')),
  ('xcape_affiliate',     jsonb_build_object('affiliate_split_percentage', 10))
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- 2. Durable CDP fee / authorization state
-- ============================================================
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS cdp_fee_status      text NOT NULL DEFAULT 'unpaid',
  ADD COLUMN IF NOT EXISTS cdp_fee_amount_paid numeric,
  ADD COLUMN IF NOT EXISTS cdp_fee_paid_at     timestamptz,
  ADD COLUMN IF NOT EXISTS cdp_fee_reference   text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'organizations_cdp_fee_status_check'
  ) THEN
    ALTER TABLE public.organizations
      ADD CONSTRAINT organizations_cdp_fee_status_check
      CHECK (cdp_fee_status IN ('unpaid','pending','paid','waived'));
  END IF;
END $$;

-- XCAPE root org never owes a partner fee.
UPDATE public.organizations SET cdp_fee_status = 'waived' WHERE kind = 'xcape_root';

-- ============================================================
-- 3. Setting accessors
-- ============================================================
CREATE OR REPLACE FUNCTION public.xcape_setting_num(_key text, _field text, _default numeric)
RETURNS numeric
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(
    (SELECT NULLIF(s.value->>_field, '')::numeric
       FROM public.site_settings s WHERE s.key = _key),
    _default);
$$;

CREATE OR REPLACE FUNCTION public.xcape_required_cdp_fee()
RETURNS numeric
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$ SELECT public.xcape_setting_num('xcape_authorization', 'cdp_required_fee', 50000); $$;

CREATE OR REPLACE FUNCTION public.xcape_affiliate_split_pct()
RETURNS numeric
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$ SELECT GREATEST(0, LEAST(100, public.xcape_setting_num('xcape_affiliate', 'affiliate_split_percentage', 10))); $$;

REVOKE EXECUTE ON FUNCTION public.xcape_setting_num(text, text, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.xcape_required_cdp_fee() TO authenticated;
GRANT EXECUTE ON FUNCTION public.xcape_affiliate_split_pct() TO authenticated;

-- ============================================================
-- 4. Server-derived authorization state
-- ============================================================
CREATE OR REPLACE FUNCTION public.xcape_authorization_state(_user uuid DEFAULT auth.uid())
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_roles      text[];
  v_role       text;
  v_status     text;
  v_org        public.organizations%ROWTYPE;
  v_fee        numeric := public.xcape_required_cdp_fee();
  v_fee_ok     boolean;
BEGIN
  IF _user IS NULL THEN
    RETURN jsonb_build_object('authorized', false, 'reason', 'unauthenticated');
  END IF;

  SELECT array_agg(role::text) INTO v_roles FROM public.user_roles WHERE user_id = _user;
  IF v_roles IS NULL OR array_length(v_roles, 1) IS NULL THEN
    RETURN jsonb_build_object('authorized', false, 'reason', 'no_role');
  END IF;

  SELECT status::text INTO v_status FROM public.staff_users WHERE id = _user;

  IF 'admin' = ANY(v_roles) THEN
    RETURN jsonb_build_object('authorized', true, 'reason', 'admin', 'role', 'admin');
  END IF;

  IF 'affiliate' = ANY(v_roles) THEN
    -- Self-serve and immediate: an affiliate is authorized on signup and only
    -- loses access if an administrator explicitly deactivates the account.
    RETURN jsonb_build_object(
      'authorized', COALESCE(v_status, 'active') <> 'inactive',
      'reason', CASE WHEN COALESCE(v_status, 'active') = 'inactive'
                     THEN 'account_inactive' ELSE 'affiliate_self_serve' END,
      'role', 'affiliate');
  END IF;

  IF 'cdp' = ANY(v_roles) THEN
    SELECT o.* INTO v_org
      FROM public.organization_members m
      JOIN public.organizations o ON o.id = m.organization_id
     WHERE m.user_id = _user AND o.kind = 'cdp'
     ORDER BY (o.status = 'active') DESC, m.created_at ASC
     LIMIT 1;

    IF v_org.id IS NULL THEN
      RETURN jsonb_build_object('authorized', false, 'reason', 'cdp_no_organization', 'role', 'cdp');
    END IF;

    v_fee_ok := v_org.cdp_fee_status IN ('paid','waived') OR COALESCE(v_fee, 0) <= 0;

    RETURN jsonb_build_object(
      'authorized', (v_org.status = 'active' AND v_fee_ok),
      'reason', CASE
        WHEN v_org.status <> 'active' THEN 'cdp_pending_approval'
        WHEN NOT v_fee_ok            THEN 'cdp_fee_required'
        ELSE 'cdp_active' END,
      'role', 'cdp',
      'org_id', v_org.id,
      'org_name', v_org.name,
      'org_status', v_org.status,
      'fee_status', v_org.cdp_fee_status,
      'required_fee', v_fee,
      'currency', COALESCE((SELECT value->>'currency' FROM public.site_settings WHERE key='xcape_authorization'), 'NGN'));
  END IF;

  -- Clinic staff and field Team keep their existing account-status rule.
  RETURN jsonb_build_object(
    'authorized', COALESCE(v_status, 'inactive') = 'active',
    'reason', CASE WHEN COALESCE(v_status,'inactive') = 'active' THEN 'staff_active' ELSE 'account_inactive' END,
    'role', v_roles[1]);
END;
$$;

CREATE OR REPLACE FUNCTION public.xcape_is_authorized(_user uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$ SELECT COALESCE((public.xcape_authorization_state(_user)->>'authorized')::boolean, false); $$;

REVOKE EXECUTE ON FUNCTION public.xcape_authorization_state(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.xcape_is_authorized(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.xcape_authorization_state(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.xcape_is_authorized(uuid) TO authenticated;

-- ============================================================
-- 5. Scan creation is blocked in the database for unauthorized partners
-- ============================================================
CREATE OR REPLACE FUNCTION public.enforce_xcape_scan_authorization()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  uid uuid := auth.uid();
BEGIN
  -- Only partner accounts are gated here; clinic/admin flows are untouched.
  IF uid IS NOT NULL
     AND public.has_role(uid, 'cdp'::public.app_role)
     AND NOT public.xcape_is_authorized(uid) THEN
    RAISE EXCEPTION 'Your partner location is not authorized to run analyses yet.'
      USING ERRCODE = '42501', HINT = 'cdp_not_authorized';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_xcape_scan_authorization ON public.client_visit_assessments;
CREATE TRIGGER trg_enforce_xcape_scan_authorization
BEFORE INSERT ON public.client_visit_assessments
FOR EACH ROW EXECUTE FUNCTION public.enforce_xcape_scan_authorization();

-- ============================================================
-- 6. Admin-only settings / fee RPCs
-- ============================================================
CREATE OR REPLACE FUNCTION public.set_cdp_fee_status(
  _org_id uuid, _status text, _amount numeric DEFAULT NULL, _reference text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'only administrators can record partner fees';
  END IF;
  IF _status NOT IN ('unpaid','pending','paid','waived') THEN
    RAISE EXCEPTION 'unsupported fee status %', _status;
  END IF;

  UPDATE public.organizations
     SET cdp_fee_status      = _status,
         cdp_fee_amount_paid = CASE WHEN _status IN ('paid','waived')
                                    THEN COALESCE(_amount, cdp_fee_amount_paid, public.xcape_required_cdp_fee())
                                    ELSE _amount END,
         cdp_fee_paid_at     = CASE WHEN _status = 'paid' THEN COALESCE(cdp_fee_paid_at, now()) ELSE NULL END,
         cdp_fee_reference   = COALESCE(NULLIF(btrim(COALESCE(_reference,'')), ''), cdp_fee_reference),
         updated_at          = now()
   WHERE id = _org_id;

  IF NOT FOUND THEN RAISE EXCEPTION 'organization not found'; END IF;
  RETURN jsonb_build_object('organization_id', _org_id, 'cdp_fee_status', _status);
END;
$$;

CREATE OR REPLACE FUNCTION public.set_xcape_admin_settings(
  _affiliate_split_percentage numeric DEFAULT NULL,
  _cdp_required_fee numeric DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'only administrators can change XCAPE settings';
  END IF;

  IF _affiliate_split_percentage IS NOT NULL THEN
    IF _affiliate_split_percentage < 0 OR _affiliate_split_percentage > 100 THEN
      RAISE EXCEPTION 'affiliate split must be between 0 and 100';
    END IF;
    INSERT INTO public.site_settings (key, value, updated_by, updated_at)
    VALUES ('xcape_affiliate',
            jsonb_build_object('affiliate_split_percentage', _affiliate_split_percentage),
            auth.uid(), now())
    ON CONFLICT (key) DO UPDATE
      SET value = public.site_settings.value
                  || jsonb_build_object('affiliate_split_percentage', _affiliate_split_percentage),
          updated_by = auth.uid(), updated_at = now();
  END IF;

  IF _cdp_required_fee IS NOT NULL THEN
    IF _cdp_required_fee < 0 THEN RAISE EXCEPTION 'fee cannot be negative'; END IF;
    INSERT INTO public.site_settings (key, value, updated_by, updated_at)
    VALUES ('xcape_authorization',
            jsonb_build_object('cdp_required_fee', _cdp_required_fee, 'currency', 'NGN'),
            auth.uid(), now())
    ON CONFLICT (key) DO UPDATE
      SET value = public.site_settings.value
                  || jsonb_build_object('cdp_required_fee', _cdp_required_fee),
          updated_by = auth.uid(), updated_at = now();
  END IF;

  RETURN jsonb_build_object(
    'affiliate_split_percentage', public.xcape_affiliate_split_pct(),
    'cdp_required_fee', public.xcape_required_cdp_fee());
END;
$$;

REVOKE EXECUTE ON FUNCTION public.set_cdp_fee_status(uuid, text, numeric, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.set_xcape_admin_settings(numeric, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_cdp_fee_status(uuid, text, numeric, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_xcape_admin_settings(numeric, numeric) TO authenticated;

-- ============================================================
-- 7. Immutable commercial snapshot on every report link
-- ============================================================
ALTER TABLE public.client_report_links
  ADD COLUMN IF NOT EXISTS commercial_snapshot jsonb;

CREATE OR REPLACE FUNCTION public.xcape_build_report_commercial_snapshot(_link_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_link        public.client_report_links%ROWTYPE;
  v_org         public.organizations%ROWTYPE;
  v_root        uuid := public.xcape_root_org_id();
  v_source      text := 'xcape';
  v_merchant    uuid;
  v_merchant_nm text := 'XCAPE';
  v_items       jsonb := '[]'::jsonb;
BEGIN
  SELECT * INTO v_link FROM public.client_report_links WHERE id = _link_id;
  IF NOT FOUND THEN RETURN NULL; END IF;

  IF v_link.origin_org_id IS NOT NULL THEN
    SELECT * INTO v_org FROM public.organizations WHERE id = v_link.origin_org_id;
  END IF;

  IF v_org.id IS NOT NULL AND v_org.kind = 'cdp' AND v_org.status = 'active' THEN
    v_merchant := v_org.id; v_merchant_nm := v_org.name; v_source := 'cdp';
  ELSE
    v_merchant := v_root;
    v_merchant_nm := COALESCE((SELECT name FROM public.organizations WHERE id = v_root), 'XCAPE');
  END IF;

  -- Catalogue products recommended on this assessment, at report-time price.
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'product_id',   p.id,
           'name',         p.name,
           'kind',         'product',
           'unit_price',   public.xcape_unit_price(p.id, v_merchant),
           'currency',     'NGN',
           'price_source', v_source)), '[]'::jsonb)
    INTO v_items
    FROM public.client_visit_assessments a
    CROSS JOIN LATERAL jsonb_array_elements(
      CASE WHEN jsonb_typeof(a.recommended_products) = 'array'
           THEN a.recommended_products ELSE '[]'::jsonb END) r
    JOIN public.products p
      ON p.id = COALESCE(NULLIF(r->>'product_id',''), NULLIF(r->>'id',''))::uuid
   WHERE a.id = v_link.assessment_id;

  -- Practitioner-approved kits keep their own immutable snapshot price.
  v_items := v_items || COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
             'product_id',          f.kit_product_id,
             'name',                COALESCE(f.kit_name, pr.name),
             'kind',                'kit',
             'unit_price',          COALESCE(NULLIF(f.kit_unit_price, 0),
                                             public.xcape_unit_price(f.kit_product_id, v_merchant)),
             'currency',            'NGN',
             'price_source',        'formula_snapshot',
             'formula_snapshot_id', f.id))
      FROM public.xcape_formula_snapshots f
      LEFT JOIN public.products pr ON pr.id = f.kit_product_id
     WHERE f.assessment_id = v_link.assessment_id
       AND f.status = 'approved'
       AND COALESCE(f.is_demo, false) = false
       AND f.kit_product_id IS NOT NULL), '[]'::jsonb);

  RETURN jsonb_build_object(
    'version', 1,
    'captured_at', now(),
    'currency', 'NGN',
    'assessment_id', v_link.assessment_id,
    'client_id', v_link.client_id,
    'origin_role', v_link.origin_role,
    'origin_user_id', v_link.created_by,
    'origin_org_id', v_link.origin_org_id,
    'merchant', jsonb_build_object(
      'org_id', v_merchant, 'name', v_merchant_nm,
      'kind', CASE WHEN v_source = 'cdp' THEN 'cdp' ELSE 'xcape_root' END,
      'price_source', v_source),
    'items', v_items);
END;
$$;

CREATE OR REPLACE FUNCTION public.stamp_report_commercial_snapshot()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.commercial_snapshot IS NULL THEN
    UPDATE public.client_report_links
       SET commercial_snapshot = public.xcape_build_report_commercial_snapshot(NEW.id)
     WHERE id = NEW.id AND commercial_snapshot IS NULL;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_report_link_commercial_snapshot ON public.client_report_links;
CREATE TRIGGER trg_report_link_commercial_snapshot
AFTER INSERT ON public.client_report_links
FOR EACH ROW EXECUTE FUNCTION public.stamp_report_commercial_snapshot();

-- Backfill existing live links so historical reports carry a snapshot too.
UPDATE public.client_report_links l
   SET commercial_snapshot = public.xcape_build_report_commercial_snapshot(l.id)
 WHERE l.commercial_snapshot IS NULL;

-- ============================================================
-- 8. Report-token pricing: snapshot price wins, unknown products rejected
-- ============================================================
CREATE OR REPLACE FUNCTION public.xcape_unit_price(_product_id uuid, _merchant_org uuid)
RETURNS numeric
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_token text := NULLIF(current_setting('xcape.report_token', true), '');
  v_snap  jsonb;
  v_item  jsonb;
BEGIN
  IF v_token IS NOT NULL THEN
    SELECT l.commercial_snapshot INTO v_snap
      FROM public.client_report_links l
     WHERE l.token_hash = encode(sha256(convert_to(btrim(v_token), 'utf8')), 'hex')
     LIMIT 1;

    IF v_snap IS NOT NULL AND jsonb_typeof(v_snap->'items') = 'array' THEN
      SELECT i INTO v_item
        FROM jsonb_array_elements(v_snap->'items') i
       WHERE NULLIF(i->>'product_id','')::uuid = _product_id
       LIMIT 1;

      IF v_item IS NULL THEN
        RAISE EXCEPTION 'This item is not part of that report.'
          USING ERRCODE = '22023', HINT = 'product_not_in_report_snapshot';
      END IF;

      RETURN COALESCE(NULLIF((v_item->>'unit_price')::numeric, 0), 0);
    END IF;
  END IF;

  RETURN COALESCE(
    (SELECT NULLIF(opp.price, 0)
       FROM public.organization_product_prices opp
      WHERE opp.organization_id = _merchant_org
        AND opp.product_id = _product_id
        AND COALESCE(opp.active, true)
      LIMIT 1),
    (SELECT COALESCE(NULLIF(p.promo_price, 0), NULLIF(p.market_price, 0),
                     NULLIF(p.selling_price, 0), 0)
       FROM public.products p WHERE p.id = _product_id));
END;
$$;

-- ============================================================
-- 9. Affiliate split snapshot on affiliate-origin orders
-- ============================================================
ALTER TABLE public.pending_outreach_orders
  ADD COLUMN IF NOT EXISTS affiliate_user_id           uuid,
  ADD COLUMN IF NOT EXISTS affiliate_split_percentage  numeric,
  ADD COLUMN IF NOT EXISTS affiliate_payout_amount     numeric,
  ADD COLUMN IF NOT EXISTS affiliate_payout_base       numeric,
  ADD COLUMN IF NOT EXISTS affiliate_payout_status     text;

CREATE OR REPLACE FUNCTION public.stamp_order_commercial_context()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_kind  text;
  v_live  boolean := false;
  v_token text;
  v_link  public.client_report_links%ROWTYPE;
  v_pct   numeric;
  v_base  numeric;
  uid     uuid := auth.uid();
BEGIN
  -- Report-sourced checkout inherits attribution from the share link itself.
  -- The verified token is the only trustworthy source; the buyer never
  -- supplies origin ids, and a signed-in buyer must not override the seller.
  IF NEW.origin_user_id IS NULL OR NEW.origin_org_id IS NULL THEN
    v_token := NULLIF(current_setting('xcape.report_token', true), '');
    IF v_token IS NOT NULL THEN
      SELECT * INTO v_link
        FROM public.client_report_links
       WHERE token_hash = encode(sha256(convert_to(btrim(v_token), 'utf8')), 'hex')
       LIMIT 1;
      IF FOUND
         AND v_link.revoked_at IS NULL
         AND (v_link.expires_at IS NULL OR v_link.expires_at > now()) THEN
        NEW.report_link_id     := COALESCE(NEW.report_link_id, v_link.id);
        NEW.customer_client_id := COALESCE(NEW.customer_client_id, v_link.client_id);
        NEW.origin_user_id     := COALESCE(NEW.origin_user_id, v_link.created_by);
        NEW.origin_org_id      := COALESCE(NEW.origin_org_id, v_link.origin_org_id);
        NEW.origin_role        := COALESCE(NEW.origin_role, v_link.origin_role);
      END IF;
    END IF;
  END IF;

  -- Fallback for orders raised inside the workspace by a signed-in operator.
  IF NEW.origin_user_id IS NULL AND uid IS NOT NULL THEN
    NEW.origin_user_id := uid;
  END IF;
  IF NEW.origin_role IS NULL AND NEW.origin_user_id IS NOT NULL THEN
    SELECT ur.role::text INTO NEW.origin_role FROM public.user_roles ur
     WHERE ur.user_id = NEW.origin_user_id
     ORDER BY CASE ur.role::text
       WHEN 'admin' THEN 1 WHEN 'cdp' THEN 2 WHEN 'affiliate' THEN 3 ELSE 4 END
     LIMIT 1;
  END IF;
  IF NEW.origin_org_id IS NULL AND NEW.origin_user_id IS NOT NULL THEN
    NEW.origin_org_id := COALESCE(public.primary_org_id(NEW.origin_user_id),
                                  public.xcape_root_org_id());
  END IF;

  SELECT o.kind, o.status = 'active' INTO v_kind, v_live
    FROM public.organizations o WHERE o.id = NEW.origin_org_id;

  IF NEW.fulfilment_org_id IS NULL THEN
    -- An approved partner location sells and fulfils its own orders; every
    -- other origin (affiliate, admin, staff, unattributed, or a partner that
    -- is not approved yet) belongs to XCAPE.
    IF v_kind = 'cdp' AND v_live THEN
      NEW.fulfilment_org_id := NEW.origin_org_id;
    ELSE
      NEW.fulfilment_org_id := public.xcape_root_org_id();
    END IF;
  END IF;

  -- Affiliate split: snapshotted at order time so later percentage changes
  -- can never move historical payouts. CDP-origin orders get no split.
  IF NEW.origin_role = 'affiliate' AND NEW.affiliate_payout_amount IS NULL THEN
    v_pct  := public.xcape_affiliate_split_pct();
    v_base := ROUND(COALESCE(NEW.unit_price, 0) * COALESCE(NEW.quantity, 0), 2);
    NEW.affiliate_user_id          := COALESCE(NEW.affiliate_user_id, NEW.origin_user_id);
    NEW.affiliate_split_percentage := v_pct;
    NEW.affiliate_payout_base      := v_base;
    NEW.affiliate_payout_amount    := ROUND(v_base * v_pct / 100.0, 2);
    NEW.affiliate_payout_status    := COALESCE(NEW.affiliate_payout_status, 'pending');
  END IF;

  IF NEW.price_snapshot IS NULL THEN
    NEW.price_snapshot := jsonb_build_object(
      'product_id',          NEW.product_id,
      'formula_snapshot_id', NEW.formula_snapshot_id,
      'unit_price',          NEW.unit_price,
      'quantity',            NEW.quantity,
      'currency',            'NGN',
      'price_source',        CASE WHEN v_kind = 'cdp' AND v_live THEN 'cdp' ELSE 'xcape' END,
      'merchant_org_id',     NEW.fulfilment_org_id,
      'report_link_id',      NEW.report_link_id,
      'origin_role',         NEW.origin_role,
      'affiliate_split_percentage', NEW.affiliate_split_percentage,
      'affiliate_payout_amount',    NEW.affiliate_payout_amount,
      'captured_at',         now());
  END IF;

  RETURN NEW;
END;
$$;