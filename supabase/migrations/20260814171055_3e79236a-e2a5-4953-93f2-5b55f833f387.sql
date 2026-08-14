-- 1) Report links: keep the creating operator's role and location on the link row.
ALTER TABLE public.client_report_links
  ADD COLUMN IF NOT EXISTS origin_role text;

CREATE OR REPLACE FUNCTION public.tg_report_link_stamp_origin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_creator uuid := COALESCE(NEW.created_by, auth.uid());
BEGIN
  IF NEW.created_by IS NULL THEN NEW.created_by := v_creator; END IF;
  IF v_creator IS NOT NULL THEN
    IF NEW.origin_org_id IS NULL THEN
      NEW.origin_org_id := COALESCE(public.primary_org_id(v_creator), public.xcape_root_org_id());
    END IF;
    IF NEW.origin_role IS NULL THEN
      NEW.origin_role := CASE
        WHEN public.has_role(v_creator, 'admin')     THEN 'admin'
        WHEN public.has_role(v_creator, 'cdp')       THEN 'cdp'
        WHEN public.has_role(v_creator, 'affiliate') THEN 'affiliate'
        ELSE 'staff' END;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.tg_report_link_stamp_origin() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_report_link_stamp_origin ON public.client_report_links;
CREATE TRIGGER trg_report_link_stamp_origin
  BEFORE INSERT ON public.client_report_links
  FOR EACH ROW EXECUTE FUNCTION public.tg_report_link_stamp_origin();

UPDATE public.client_report_links l
   SET origin_org_id = COALESCE(l.origin_org_id, public.primary_org_id(l.created_by), public.xcape_root_org_id()),
       origin_role = COALESCE(l.origin_role, CASE
         WHEN public.has_role(l.created_by, 'admin')     THEN 'admin'
         WHEN public.has_role(l.created_by, 'cdp')       THEN 'cdp'
         WHEN public.has_role(l.created_by, 'affiliate') THEN 'affiliate'
         ELSE 'staff' END)
 WHERE l.created_by IS NOT NULL
   AND (l.origin_org_id IS NULL OR l.origin_role IS NULL);

-- 2) Partners must not be able to claim someone else's attribution on insert.
CREATE OR REPLACE FUNCTION public.stamp_xcape_origin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  org uuid;
  r text;
BEGIN
  IF uid IS NULL THEN RETURN NEW; END IF;
  -- Only an admin may record a row on behalf of another operator; everyone
  -- else is pinned to their own identity regardless of what was submitted.
  IF NEW.origin_user_id IS NULL
     OR (NEW.origin_user_id <> uid AND NOT public.has_role(uid, 'admin')) THEN
    NEW.origin_user_id := uid;
  END IF;
  IF NEW.origin_role IS NULL THEN
    SELECT ur.role::text INTO r FROM public.user_roles ur
    WHERE ur.user_id = NEW.origin_user_id
    ORDER BY CASE ur.role::text
      WHEN 'admin' THEN 1 WHEN 'cdp' THEN 2 WHEN 'affiliate' THEN 3 ELSE 4 END
    LIMIT 1;
    NEW.origin_role := r;
  END IF;
  IF NEW.origin_org_id IS NULL THEN
    org := public.primary_org_id(NEW.origin_user_id);
    NEW.origin_org_id := COALESCE(org, public.xcape_root_org_id());
  END IF;
  RETURN NEW;
END;
$$;

-- 3) Orders: a single stamping trigger. The duplicate origin trigger ran first
-- and credited the signed-in buyer, defeating share-link attribution.
DROP TRIGGER IF EXISTS stamp_origin_orders ON public.pending_outreach_orders;

CREATE OR REPLACE FUNCTION public.stamp_order_commercial_context()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_kind  text;
  v_token text;
  v_link  public.client_report_links%ROWTYPE;
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

  SELECT o.kind INTO v_kind FROM public.organizations o WHERE o.id = NEW.origin_org_id;

  IF NEW.fulfilment_org_id IS NULL THEN
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
      'product_id',          NEW.product_id,
      'formula_snapshot_id', NEW.formula_snapshot_id,
      'unit_price',          NEW.unit_price,
      'quantity',            NEW.quantity,
      'currency',            'NGN',
      'price_source',        CASE WHEN v_kind = 'cdp' THEN 'cdp' ELSE 'xcape' END,
      'merchant_org_id',     NEW.fulfilment_org_id,
      'captured_at',         now()
    );
  END IF;

  RETURN NEW;
END;
$$;

-- 4) Purchase-time price must be the price book the buyer actually saw.
CREATE OR REPLACE FUNCTION public.xcape_report_merchant_org(_token text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT o.id
    FROM public.client_report_links l
    JOIN public.organizations o ON o.id = l.origin_org_id
   WHERE NULLIF(btrim(COALESCE(_token,'')), '') IS NOT NULL
     AND l.token_hash = encode(sha256(convert_to(btrim(_token), 'utf8')), 'hex')
     AND l.revoked_at IS NULL
     AND (l.expires_at IS NULL OR l.expires_at > now())
     AND o.kind = 'cdp'
   LIMIT 1;
$$;
REVOKE EXECUTE ON FUNCTION public.xcape_report_merchant_org(text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.xcape_unit_price(_product_id uuid, _merchant_org uuid)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT NULLIF(opp.price, 0)
       FROM public.organization_product_prices opp
      WHERE opp.organization_id = _merchant_org
        AND opp.product_id = _product_id
        AND COALESCE(opp.active, true)
      LIMIT 1),
    (SELECT COALESCE(NULLIF(p.promo_price, 0), NULLIF(p.market_price, 0),
                     NULLIF(p.selling_price, 0), 0)
       FROM public.products p WHERE p.id = _product_id)
  );
$$;
REVOKE EXECUTE ON FUNCTION public.xcape_unit_price(uuid, uuid) FROM PUBLIC, anon, authenticated;

-- Rewrite the public cart RPC to price every line through the resolved price
-- book. Patched from the live definition so no other behaviour changes.
DO $do$
DECLARE
  def text;
  patched text;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO def
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'submit_public_cart_order';

  IF def IS NULL THEN
    RAISE EXCEPTION 'submit_public_cart_order not found';
  END IF;

  IF position('xcape_unit_price' in def) > 0 THEN
    RETURN; -- already patched
  END IF;

  IF (length(def) - length(replace(def,
      'v_unit_price := COALESCE(v_product.promo_price, v_product.market_price, v_product.selling_price, 0);', '')))
      / length('v_unit_price := COALESCE(v_product.promo_price, v_product.market_price, v_product.selling_price, 0);') <> 2 THEN
    RAISE EXCEPTION 'unexpected submit_public_cart_order body: pricing lines not found';
  END IF;

  patched := replace(def,
    'v_unit_price := COALESCE(v_product.promo_price, v_product.market_price, v_product.selling_price, 0);',
    'v_unit_price := public.xcape_unit_price(v_pid, v_merchant_org);');

  patched := overlay(patched placing E'DECLARE\n  v_merchant_org uuid;\n'
                     from position(E'DECLARE\n' in patched)
                     for length(E'DECLARE\n'));

  patched := replace(patched,
    '  SELECT value INTO v_settings FROM public.site_settings WHERE key = ''delivery'';',
    E'  v_merchant_org := public.xcape_report_merchant_org(\n    NULLIF(current_setting(''xcape.report_token'', true), ''''));\n\n  SELECT value INTO v_settings FROM public.site_settings WHERE key = ''delivery'';');

  EXECUTE patched;
END
$do$;