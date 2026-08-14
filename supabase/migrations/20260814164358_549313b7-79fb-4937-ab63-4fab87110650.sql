-- Anonymous report checkout: carry the secure share link's origin onto the order.
-- The buyer is not signed in, so auth.uid() cannot attribute the sale. The
-- wrapper sets a transaction-local token that the existing insert trigger
-- resolves before fulfilment routing and price snapshotting run.

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
  v_result jsonb;
BEGIN
  PERFORM set_config('xcape.report_token', COALESCE(NULLIF(btrim(COALESCE(_report_token, '')), ''), ''), true);
  v_result := public.submit_public_cart_order(
    _items, _customer_phone, _customer_name, _customer_email, _order_ref,
    _referral_staff_id, _outreach_id, _attributed_staff_id, _notes,
    _delivery_method, _delivery_address, _promo_code
  );
  PERFORM set_config('xcape.report_token', '', true);
  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_public_cart_order_from_report(jsonb, text, text, text, text, text, uuid, uuid, uuid, text, text, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.submit_public_cart_order_from_report(jsonb, text, text, text, text, text, uuid, uuid, uuid, text, text, text, text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.stamp_order_commercial_context()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_kind text;
  v_token text;
  v_link public.client_report_links%ROWTYPE;
BEGIN
  -- Report-sourced anonymous checkout inherits attribution from the share link.
  IF NEW.origin_user_id IS NULL OR NEW.origin_org_id IS NULL THEN
    v_token := NULLIF(current_setting('xcape.report_token', true), '');
    IF v_token IS NOT NULL THEN
      SELECT * INTO v_link
        FROM public.client_report_links
       WHERE token_hash = encode(sha256(convert_to(btrim(v_token), 'utf8')), 'hex')
       LIMIT 1;
      IF FOUND AND v_link.revoked_at IS NULL AND v_link.expires_at > now() THEN
        NEW.report_link_id := COALESCE(NEW.report_link_id, v_link.id);
        NEW.origin_user_id := COALESCE(NEW.origin_user_id, v_link.origin_user_id);
        NEW.origin_role    := COALESCE(NEW.origin_role, v_link.origin_role);
        NEW.origin_org_id  := COALESCE(v_link.origin_org_id, NEW.origin_org_id);
      END IF;
    END IF;
  END IF;

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

-- Ensure the origin stamp runs before the commercial routing stamp.
DROP TRIGGER IF EXISTS trg_stamp_order_commercial_context ON public.pending_outreach_orders;
CREATE TRIGGER trg_stamp_order_commercial_context
BEFORE INSERT ON public.pending_outreach_orders
FOR EACH ROW EXECUTE FUNCTION public.stamp_order_commercial_context();