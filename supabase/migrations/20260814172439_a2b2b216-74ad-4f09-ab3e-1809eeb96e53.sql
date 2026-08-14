-- A partner location only sells and fulfils on its own price book while it is
-- actually approved; a pending or suspended CDP falls back to XCAPE.
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
     AND o.status = 'active'
   LIMIT 1;
$$;

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
      'captured_at',         now()
    );
  END IF;

  RETURN NEW;
END;
$$;

-- A purchase that claims to come from a shared report must present a link that
-- is real, live and not revoked. Anything else is refused: we would rather have
-- no order than an order whose seller cannot be established.
CREATE OR REPLACE FUNCTION public.submit_public_cart_order_from_report(
  _items jsonb,
  _customer_phone text,
  _customer_name text,
  _report_token text,
  _customer_email text DEFAULT NULL::text,
  _order_ref text DEFAULT NULL::text,
  _referral_staff_id uuid DEFAULT NULL::uuid,
  _outreach_id uuid DEFAULT NULL::uuid,
  _attributed_staff_id uuid DEFAULT NULL::uuid,
  _notes text DEFAULT NULL::text,
  _delivery_method text DEFAULT 'pickup'::text,
  _delivery_address text DEFAULT NULL::text,
  _promo_code text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_token  text := NULLIF(btrim(COALESCE(_report_token, '')), '');
  v_link   public.client_report_links%ROWTYPE;
  v_result jsonb;
BEGIN
  IF v_token IS NULL THEN
    RAISE EXCEPTION 'report link required'
      USING ERRCODE = '22023', HINT = 'missing_report_token';
  END IF;

  SELECT * INTO v_link
    FROM public.client_report_links
   WHERE token_hash = encode(sha256(convert_to(v_token, 'utf8')), 'hex')
   LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'This report link is not valid.'
      USING ERRCODE = '22023', HINT = 'invalid_report_token';
  END IF;
  IF v_link.revoked_at IS NOT NULL THEN
    RAISE EXCEPTION 'This report link has been revoked.'
      USING ERRCODE = '22023', HINT = 'revoked_report_token';
  END IF;
  IF v_link.expires_at IS NOT NULL AND v_link.expires_at <= now() THEN
    RAISE EXCEPTION 'This report link has expired.'
      USING ERRCODE = '22023', HINT = 'expired_report_token';
  END IF;

  PERFORM set_config('xcape.report_token', v_token, true);
  v_result := public.submit_public_cart_order(
    _items, _customer_phone, _customer_name, _customer_email, _order_ref,
    _referral_staff_id, _outreach_id, _attributed_staff_id, _notes,
    _delivery_method, _delivery_address, _promo_code
  );
  PERFORM set_config('xcape.report_token', '', true);
  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_public_cart_order_from_report(jsonb, text, text, text, text, text, uuid, uuid, uuid, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_public_cart_order_from_report(jsonb, text, text, text, text, text, uuid, uuid, uuid, text, text, text, text) TO anon, authenticated;