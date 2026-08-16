-- Idempotent mirror of the live XCAPE commerce hardening (pricing, merchant
-- routing, claim review/fulfilment, least-privilege grants). Safe to re-run.

-- ---------------- RLS policies (drop old + new names first) ----------------
DROP POLICY IF EXISTS "commerce settings readable by admin or own org" ON public.xcape_commerce_settings;
DROP POLICY IF EXISTS "commerce settings readable by admin or active own org" ON public.xcape_commerce_settings;
CREATE POLICY "commerce settings readable by admin or active own org"
ON public.xcape_commerce_settings FOR SELECT TO authenticated
USING (public.is_admin((SELECT auth.uid())) OR public.can_read_org_scope(organization_id, (SELECT auth.uid())));

DROP POLICY IF EXISTS "claims readable by admin or fulfilling org" ON public.xcape_report_payment_claims;
DROP POLICY IF EXISTS "claims readable by admin or active fulfilling org" ON public.xcape_report_payment_claims;
CREATE POLICY "claims readable by admin or active fulfilling org"
ON public.xcape_report_payment_claims FOR SELECT TO authenticated
USING (public.is_admin((SELECT auth.uid())) OR (merchant_org_id IS NOT NULL AND public.can_read_org_scope(merchant_org_id, (SELECT auth.uid()))));

-- ---------------- functions ----------------
CREATE OR REPLACE FUNCTION public.can_read_org_scope(_org uuid, _user uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_members m
    JOIN public.organizations o ON o.id = m.organization_id
    WHERE m.organization_id = _org
      AND m.user_id = _user
      AND m.status = 'active'
      AND o.kind = 'cdp'
      AND o.status = 'active'
  );
$function$
;

CREATE OR REPLACE FUNCTION public.stamp_order_commercial_context()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_kind  text;
  v_live  boolean := false;
  v_token text;
  v_link  public.client_report_links%ROWTYPE;
  v_pct   numeric;
  v_base  numeric;
  v_cdp   boolean := false;
  uid     uuid := auth.uid();
BEGIN
  IF NEW.origin_user_id IS NULL OR NEW.origin_org_id IS NULL THEN
    v_token := NULLIF(current_setting('xcape.report_token', true), '');
    IF v_token IS NOT NULL THEN
      SELECT * INTO v_link FROM public.client_report_links
       WHERE token_hash = encode(sha256(convert_to(btrim(v_token), 'utf8')), 'hex') LIMIT 1;
      IF FOUND AND v_link.revoked_at IS NULL
         AND (v_link.expires_at IS NULL OR v_link.expires_at > now()) THEN
        NEW.report_link_id     := COALESCE(NEW.report_link_id, v_link.id);
        NEW.customer_client_id := COALESCE(NEW.customer_client_id, v_link.client_id);
        NEW.origin_user_id     := COALESCE(NEW.origin_user_id, v_link.created_by);
        NEW.origin_org_id      := COALESCE(NEW.origin_org_id, v_link.origin_org_id);
        NEW.origin_role        := COALESCE(NEW.origin_role, v_link.origin_role);
      END IF;
    END IF;
  END IF;

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

  -- Role decides FIRST: an affiliate sitting in a CDP org still sells for XCAPE.
  v_cdp := (NEW.origin_role = 'cdp' AND v_kind = 'cdp' AND COALESCE(v_live, false));

  IF NEW.fulfilment_org_id IS NULL THEN
    NEW.fulfilment_org_id := CASE WHEN v_cdp THEN NEW.origin_org_id
                                  ELSE public.xcape_root_org_id() END;
  END IF;

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
      'currency',            CASE WHEN NEW.report_link_id IS NOT NULL THEN 'XAF' ELSE 'NGN' END,
      'price_source',        CASE WHEN v_cdp THEN 'cdp' ELSE 'xcape' END,
      'merchant_org_id',     NEW.fulfilment_org_id,
      'report_link_id',      NEW.report_link_id,
      'origin_role',         NEW.origin_role,
      'affiliate_split_percentage', NEW.affiliate_split_percentage,
      'affiliate_payout_amount',    NEW.affiliate_payout_amount,
      'captured_at',         now());
  END IF;

  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.submit_report_momo_order(_report_token text, _items jsonb, _buyer_name text, _buyer_phone text, _sender_phone text, _amount_sent numeric, _buyer_email text DEFAULT NULL::text, _notes text DEFAULT NULL::text, _payment_reference text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_ctx jsonb; v_merchant uuid; v_assessment uuid; v_link uuid; v_client uuid;
  v_set public.xcape_commerce_settings%ROWTYPE;
  v_item jsonb; v_pid uuid; v_qty numeric; v_price numeric;
  v_total numeric := 0; v_count int := 0; v_ref text;
  v_name text; v_phone text; v_sender text; v_amount numeric;
  v_claim uuid; v_contact jsonb; v_product public.products%ROWTYPE;
BEGIN
  v_ctx := public.xcape_report_context(_report_token);
  IF NOT COALESCE((v_ctx->>'ok')::boolean, false) THEN
    RAISE EXCEPTION 'This report link is not valid.'
      USING ERRCODE='22023', HINT = COALESCE(v_ctx->>'reason','invalid_token');
  END IF;
  v_link       := (v_ctx->>'link_id')::uuid;
  v_merchant   := (v_ctx->>'merchant_org_id')::uuid;
  v_assessment := (v_ctx->>'assessment_id')::uuid;
  v_client     := (v_ctx->>'client_id')::uuid;

  SELECT * INTO v_set FROM public.xcape_commerce_settings WHERE organization_id = v_merchant;
  IF NOT FOUND OR NOT COALESCE(v_set.commerce_enabled, false)
     OR NULLIF(btrim(COALESCE(v_set.momo_provider,'')),'') IS NULL
     OR NULLIF(btrim(COALESCE(v_set.momo_recipient_number,'')),'') IS NULL
     OR NULLIF(btrim(COALESCE(v_set.order_contact_phone,'')),'') IS NULL THEN
    RAISE EXCEPTION 'Ordering is not available for this report yet.'
      USING ERRCODE='22023', HINT='commerce_not_configured';
  END IF;

  v_name   := NULLIF(btrim(COALESCE(_buyer_name,'')), '');
  v_phone  := regexp_replace(COALESCE(_buyer_phone,''), '\D', '', 'g');
  v_sender := regexp_replace(COALESCE(_sender_phone,''), '\D', '', 'g');
  IF v_name IS NULL OR length(v_name) < 2 THEN
    RAISE EXCEPTION 'Enter your name' USING ERRCODE='check_violation';
  END IF;
  IF length(v_phone) < 7 OR length(v_phone) > 15 THEN
    RAISE EXCEPTION 'Enter a valid phone number' USING ERRCODE='check_violation';
  END IF;
  IF length(v_sender) < 7 OR length(v_sender) > 15 THEN
    RAISE EXCEPTION 'Enter the number you paid from' USING ERRCODE='check_violation';
  END IF;
  v_amount := ROUND(COALESCE(_amount_sent, 0), 2);
  IF v_amount <= 0 THEN
    RAISE EXCEPTION 'Enter the amount you sent' USING ERRCODE='check_violation';
  END IF;
  IF _items IS NULL OR jsonb_typeof(_items) <> 'array' OR jsonb_array_length(_items) = 0 THEN
    RAISE EXCEPTION 'Your order is empty' USING ERRCODE='check_violation';
  END IF;

  -- Pass 1: validate eligibility and price live.
  FOR v_item IN SELECT * FROM jsonb_array_elements(_items) LOOP
    v_pid := NULLIF(v_item->>'product_id','')::uuid;
    v_qty := FLOOR(COALESCE((v_item->>'quantity')::numeric, 0));
    IF v_pid IS NULL OR v_qty <= 0 OR v_qty > 50 THEN
      RAISE EXCEPTION 'Invalid order item' USING ERRCODE='check_violation';
    END IF;
    IF NOT public.xcape_report_eligible_product(v_assessment, v_pid) THEN
      RAISE EXCEPTION 'This item is not part of that report.'
        USING ERRCODE='22023', HINT='product_not_on_report';
    END IF;
    SELECT * INTO v_product FROM public.products WHERE id = v_pid AND active = true;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Product unavailable' USING ERRCODE='check_violation';
    END IF;
    v_price := public.xcape_unit_price(v_pid, v_merchant);
    IF COALESCE(v_price, 0) <= 0 THEN
      RAISE EXCEPTION 'This item has no price yet.' USING ERRCODE='22023', HINT='price_not_configured';
    END IF;
    v_total := v_total + (v_qty * v_price);
  END LOOP;

  v_ref := 'XCP-' || to_char(now(), 'YYMMDD') || '-' || upper(substr(md5(random()::text), 1, 6));
  v_contact := jsonb_build_object(
    'merchant_org_id', v_merchant,
    'merchant_name', v_ctx->>'merchant_name',
    'order_contact_phone', v_set.order_contact_phone,
    'whatsapp_number', v_set.whatsapp_number,
    'momo_provider', v_set.momo_provider,
    'momo_recipient_number', v_set.momo_recipient_number,
    'momo_recipient_name', v_set.momo_recipient_name,
    'captured_at', now());

  INSERT INTO public.xcape_report_payment_claims (
    order_ref, report_link_id, client_id, merchant_org_id,
    origin_role, origin_user_id, origin_org_id,
    buyer_name, buyer_phone, buyer_email, buyer_note,
    sender_phone, submitted_amount, amount_due, currency,
    provider, recipient_number, reference, status, merchant_contact_snapshot)
  VALUES (
    v_ref, v_link, v_client, v_merchant,
    v_ctx->>'origin_role', NULLIF(v_ctx->>'created_by','')::uuid,
    NULLIF(v_ctx->>'origin_org_id','')::uuid,
    v_name, v_phone, NULLIF(btrim(COALESCE(_buyer_email,'')), ''),
    LEFT(NULLIF(btrim(COALESCE(_notes,'')), ''), 500),
    v_sender, v_amount, ROUND(v_total, 2), 'XAF',
    v_set.momo_provider, v_set.momo_recipient_number,
    LEFT(NULLIF(btrim(COALESCE(_payment_reference,'')), ''), 120),
    'submitted', v_contact)
  RETURNING id INTO v_claim;

  -- Pass 2: write immutable order lines.
  FOR v_item IN SELECT * FROM jsonb_array_elements(_items) LOOP
    v_pid := (v_item->>'product_id')::uuid;
    v_qty := FLOOR((v_item->>'quantity')::numeric);
    v_price := public.xcape_unit_price(v_pid, v_merchant);

    INSERT INTO public.pending_outreach_orders (
      product_id, quantity, unit_price, customer_phone, customer_name,
      customer_client_id, payment_method, payment_reference, notes, order_ref,
      delivery_method, status, report_link_id, report_payment_claim_id,
      origin_user_id, origin_role, origin_org_id, fulfilment_org_id, price_snapshot)
    VALUES (
      v_pid, v_qty, v_price, v_phone, v_name,
      v_client, 'online',
      LEFT(NULLIF(btrim(COALESCE(_payment_reference,'')), ''), 120),
      '[ref:' || v_ref || '] XCAPE report order (Mobile Money — awaiting verification)'
        || COALESCE(' — ' || NULLIF(btrim(COALESCE(_notes,'')), ''), ''),
      v_ref, 'pickup', 'pending', v_link, v_claim,
      NULLIF(v_ctx->>'created_by','')::uuid,
      v_ctx->>'origin_role',
      NULLIF(v_ctx->>'origin_org_id','')::uuid,
      v_merchant,
      jsonb_build_object(
        'product_id', v_pid, 'unit_price', v_price, 'quantity', v_qty,
        'currency', 'XAF',
        'price_source', v_ctx->>'price_source',
        'merchant_org_id', v_merchant,
        'merchant_name', v_ctx->>'merchant_name',
        'report_link_id', v_link,
        'origin_role', v_ctx->>'origin_role',
        'order_ref', v_ref,
        'merchant_contact', v_contact,
        'captured_at', now()));
    v_count := v_count + 1;
  END LOOP;

  BEGIN
    INSERT INTO public.client_report_events (link_id, event_type, payload)
    VALUES (v_link, 'payment_claim_submitted',
            jsonb_build_object('order_ref', v_ref, 'amount_due', ROUND(v_total,2),
                               'amount_sent', v_amount, 'items', v_count));
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  RETURN jsonb_build_object(
    'ok', true,
    'order_ref', v_ref,
    'claim_id', v_claim,
    'currency', 'XAF',
    'amount_due', ROUND(v_total, 2),
    'amount_sent', v_amount,
    'amount_matches', ROUND(v_total,2) = v_amount,
    'item_count', v_count,
    'status', 'awaiting_verification',
    'merchant', jsonb_build_object(
      'name', v_ctx->>'merchant_name',
      'order_contact_phone', v_set.order_contact_phone,
      'whatsapp_number', v_set.whatsapp_number,
      'momo_provider', v_set.momo_provider,
      'momo_recipient_number', v_set.momo_recipient_number));
END;
$function$
;

CREATE OR REPLACE FUNCTION public.xcape_build_report_commercial_snapshot(_link_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.xcape_fulfil_report_order(_claim_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_claim public.xcape_report_payment_claims%ROWTYPE;
  v_line public.pending_outreach_orders%ROWTYPE;
  v_total_count integer;
  v_pending_count integer;
  v_paid_count integer;
  v_cancelled_count integer;
  v_fulfilled_count integer := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT *
    INTO v_claim
    FROM public.xcape_report_payment_claims
   WHERE id = _claim_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment claim not found'
      USING ERRCODE = 'no_data_found';
  END IF;

  IF NOT public.xcape_may_review_claim(_claim_id) THEN
    RAISE EXCEPTION 'You cannot fulfil this order'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF v_claim.status <> 'verified' THEN
    RAISE EXCEPTION 'Verify the Mobile Money payment before fulfilment'
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT
    count(*)::integer,
    count(*) FILTER (WHERE status = 'pending')::integer,
    count(*) FILTER (WHERE status = 'paid')::integer,
    count(*) FILTER (WHERE status = 'cancelled')::integer
  INTO
    v_total_count,
    v_pending_count,
    v_paid_count,
    v_cancelled_count
  FROM public.pending_outreach_orders
  WHERE report_payment_claim_id = _claim_id;

  IF v_total_count = 0 THEN
    RAISE EXCEPTION 'No order lines are linked to this payment claim'
      USING ERRCODE = 'no_data_found';
  END IF;

  IF v_cancelled_count > 0 THEN
    RAISE EXCEPTION 'This order contains a cancelled line and needs review'
      USING ERRCODE = 'check_violation';
  END IF;

  FOR v_line IN
    SELECT p.*
    FROM public.pending_outreach_orders p
    WHERE p.report_payment_claim_id = _claim_id
      AND p.status = 'pending'
    ORDER BY p.created_at, p.id
    FOR UPDATE
  LOOP
    PERFORM public.confirm_pending_outreach_order(
      v_line.id,
      'online',
      COALESCE(NULLIF(v_claim.reference, ''), v_claim.order_ref)
    );
    v_fulfilled_count := v_fulfilled_count + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'ok', true,
    'claim_id', v_claim.id,
    'order_ref', v_claim.order_ref,
    'line_count', v_total_count,
    'paid_line_count', v_paid_count + v_fulfilled_count,
    'newly_fulfilled_count', v_fulfilled_count,
    'already_fulfilled', v_pending_count = 0
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.xcape_get_commerce_settings()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_org uuid; v_row public.xcape_commerce_settings%ROWTYPE; v_name text;
BEGIN
  v_org := public.xcape_my_commerce_org();
  IF v_org IS NULL THEN RETURN jsonb_build_object('editable', false); END IF;
  SELECT * INTO v_row FROM public.xcape_commerce_settings WHERE organization_id = v_org;
  SELECT name INTO v_name FROM public.organizations WHERE id = v_org;
  RETURN jsonb_build_object(
    'editable', true,
    'organization_id', v_org,
    'organization_name', v_name,
    'commerce_enabled', COALESCE(v_row.commerce_enabled, false),
    'order_contact_phone', v_row.order_contact_phone,
    'whatsapp_number', v_row.whatsapp_number,
    'momo_provider', v_row.momo_provider,
    'momo_recipient_number', v_row.momo_recipient_number,
    'momo_recipient_name', v_row.momo_recipient_name,
    'currency', COALESCE(v_row.currency, 'XAF'));
END;
$function$
;

CREATE OR REPLACE FUNCTION public.xcape_may_manage_pending_order(_pending_order_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.pending_outreach_orders p
      WHERE p.id = _pending_order_id
        AND (
          public.is_admin(auth.uid())
          OR (
            p.report_payment_claim_id IS NOT NULL
            AND public.xcape_may_review_claim(p.report_payment_claim_id)
          )
          OR (
            p.report_payment_claim_id IS NULL
            AND (
              public.has_role(auth.uid(), 'front_desk'::public.app_role)
              OR p.created_by = auth.uid()
              OR p.attributed_staff_id = auth.uid()
              OR p.confirmed_by = auth.uid()
              OR (
                p.fulfilment_org_id IS NOT NULL
                AND public.can_read_org_scope(p.fulfilment_org_id, auth.uid())
              )
              OR EXISTS (
                SELECT 1
                FROM public.outreach_sessions os
                WHERE os.id = p.outreach_id
                  AND (
                    os.coordinator_user_id = auth.uid()
                    OR os.initiator_staff_id = auth.uid()
                    OR os.created_by = auth.uid()
                  )
              )
            )
          )
        )
    );
$function$
;

CREATE OR REPLACE FUNCTION public.xcape_may_review_claim(_claim_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.xcape_report_payment_claims c
     WHERE c.id = _claim_id
       AND (public.is_admin(auth.uid())
            OR (public.is_org_member(c.merchant_org_id, auth.uid())
                AND EXISTS (SELECT 1 FROM public.organizations o
                             WHERE o.id = c.merchant_org_id AND o.kind = 'cdp' AND o.status = 'active')))
  );
$function$
;

CREATE OR REPLACE FUNCTION public.xcape_my_commerce_org()
 RETURNS uuid
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_org uuid; v_kind text; v_status text;
BEGIN
  IF auth.uid() IS NULL THEN RETURN NULL; END IF;
  IF public.is_admin(auth.uid()) THEN RETURN public.xcape_root_org_id(); END IF;
  v_org := public.primary_org_id(auth.uid());
  SELECT o.kind, o.status INTO v_kind, v_status FROM public.organizations o WHERE o.id = v_org;
  IF v_kind = 'cdp' AND v_status = 'active' AND public.is_org_member(v_org, auth.uid()) THEN
    RETURN v_org;
  END IF;
  RETURN NULL;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.xcape_reject_payment_claim(_claim_id uuid, _reason text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_row public.xcape_report_payment_claims%ROWTYPE;
  v_reason text := NULLIF(btrim(COALESCE(_reason, '')), '');
BEGIN
  IF auth.uid() IS NULL OR NOT public.xcape_may_review_claim(_claim_id) THEN
    RAISE EXCEPTION 'You cannot review this payment'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF v_reason IS NULL OR length(v_reason) < 3 THEN
    RAISE EXCEPTION 'Give a reason for rejecting this payment'
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT *
    INTO v_row
    FROM public.xcape_report_payment_claims
   WHERE id = _claim_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment claim not found'
      USING ERRCODE = 'no_data_found';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM public.pending_outreach_orders p
     WHERE p.report_payment_claim_id = _claim_id
       AND p.status = 'paid'
  ) THEN
    RAISE EXCEPTION 'A fulfilled payment cannot be rejected'
      USING ERRCODE = 'check_violation';
  END IF;

  IF v_row.status = 'rejected' THEN
    RETURN jsonb_build_object(
      'ok', true,
      'order_ref', v_row.order_ref,
      'status', v_row.status,
      'already_rejected', true
    );
  END IF;

  IF v_row.status <> 'submitted' THEN
    RAISE EXCEPTION 'Only a submitted payment can be rejected'
      USING ERRCODE = 'check_violation';
  END IF;

  UPDATE public.xcape_report_payment_claims
     SET status = 'rejected',
         reviewed_by = auth.uid(),
         reviewed_at = now(),
         rejected_reason = LEFT(v_reason, 500),
         updated_at = now()
   WHERE id = _claim_id
   RETURNING * INTO v_row;

  RETURN jsonb_build_object(
    'ok', true,
    'order_ref', v_row.order_ref,
    'status', v_row.status,
    'already_rejected', false
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.xcape_report_context(_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_tok  text := NULLIF(btrim(COALESCE(_token,'')), '');
  v_link public.client_report_links%ROWTYPE;
  v_org  public.organizations%ROWTYPE;
  v_root uuid := public.xcape_root_org_id();
  v_merchant uuid;
  v_name text := 'XCAPE';
  v_src  text := 'xcape';
BEGIN
  IF v_tok IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'missing_token'); END IF;

  SELECT * INTO v_link FROM public.client_report_links
   WHERE token_hash = encode(sha256(convert_to(v_tok, 'utf8')), 'hex') LIMIT 1;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'reason', 'invalid_token'); END IF;
  IF v_link.revoked_at IS NOT NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'revoked_token'); END IF;
  IF v_link.expires_at IS NOT NULL AND v_link.expires_at <= now() THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'expired_token');
  END IF;

  -- Trusted origin ROLE decides the merchant first. Only a cdp-origin report
  -- with an active CDP organisation routes away from XCAPE root.
  IF v_link.origin_role = 'cdp' AND v_link.origin_org_id IS NOT NULL THEN
    SELECT * INTO v_org FROM public.organizations WHERE id = v_link.origin_org_id;
    IF FOUND AND v_org.kind = 'cdp' AND v_org.status = 'active' THEN
      v_merchant := v_org.id; v_name := v_org.name; v_src := 'cdp';
    END IF;
  END IF;

  IF v_merchant IS NULL THEN
    v_merchant := v_root;
    v_name := COALESCE((SELECT name FROM public.organizations WHERE id = v_root), 'XCAPE');
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'link_id', v_link.id,
    'client_id', v_link.client_id,
    'assessment_id', v_link.assessment_id,
    'created_by', v_link.created_by,
    'origin_role', v_link.origin_role,
    'origin_org_id', v_link.origin_org_id,
    'merchant_org_id', v_merchant,
    'merchant_name', v_name,
    'price_source', v_src,
    'currency', 'XAF'
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.xcape_report_eligible_product(_assessment_id uuid, _product_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.client_visit_assessments a,
      LATERAL jsonb_array_elements(
        CASE WHEN jsonb_typeof(a.recommended_products) = 'array'
             THEN a.recommended_products ELSE '[]'::jsonb END) r
     WHERE a.id = _assessment_id
       AND COALESCE(NULLIF(r->>'product_id',''), NULLIF(r->>'id','')) = _product_id::text
  ) OR EXISTS (
    SELECT 1 FROM public.xcape_formula_snapshots f
     WHERE f.assessment_id = _assessment_id
       AND f.status = 'approved'
       AND COALESCE(f.is_demo, false) = false
       AND f.kit_product_id = _product_id
  );
$function$
;

CREATE OR REPLACE FUNCTION public.xcape_report_merchant_org(_token text)
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT o.id
    FROM public.client_report_links l
    JOIN public.organizations o ON o.id = l.origin_org_id
   WHERE NULLIF(btrim(COALESCE(_token,'')), '') IS NOT NULL
     AND l.token_hash = encode(sha256(convert_to(btrim(_token), 'utf8')), 'hex')
     AND l.revoked_at IS NULL
     AND (l.expires_at IS NULL OR l.expires_at > now())
     AND l.origin_role = 'cdp'
     AND o.kind = 'cdp'
     AND o.status = 'active'
   LIMIT 1;
$function$
;

CREATE OR REPLACE FUNCTION public.xcape_resolved_price(_org uuid, _product uuid)
 RETURNS numeric
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT COALESCE(
    (
      SELECT opp.price
      FROM public.organization_product_prices opp
      JOIN public.organizations o ON o.id = opp.organization_id
      WHERE opp.organization_id = _org
        AND opp.product_id = _product
        AND opp.active IS TRUE
        AND opp.price > 0
        AND o.kind = 'cdp'
        AND o.status = 'active'
      LIMIT 1
    ),
    (
      SELECT p.selling_price
      FROM public.products p
      WHERE p.id = _product
        AND p.active IS TRUE
        AND p.selling_price > 0
      LIMIT 1
    )
  );
$function$
;

CREATE OR REPLACE FUNCTION public.xcape_retail_price_book()
 RETURNS TABLE(product_id uuid, sku text, name text, image_url text, default_price numeric, override_price numeric, resolved_price numeric, currency text, org_id uuid, org_kind text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_org uuid; v_kind text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE='insufficient_privilege';
  END IF;
  v_org := public.primary_org_id(auth.uid());
  SELECT o.kind INTO v_kind FROM public.organizations o
   WHERE o.id = v_org AND o.status = 'active';

  RETURN QUERY
  SELECT p.id, p.sku, p.name, p.image_url,
         NULLIF(p.selling_price, 0)::numeric,
         CASE WHEN v_kind = 'cdp'
              THEN (SELECT NULLIF(opp.price, 0) FROM public.organization_product_prices opp
                     WHERE opp.organization_id = v_org AND opp.product_id = p.id
                       AND COALESCE(opp.active, true) LIMIT 1)
              ELSE NULL END,
         CASE WHEN v_kind = 'cdp'
              THEN COALESCE(
                     (SELECT NULLIF(opp.price, 0) FROM public.organization_product_prices opp
                       WHERE opp.organization_id = v_org AND opp.product_id = p.id
                         AND COALESCE(opp.active, true) AND opp.price > 0 LIMIT 1),
                     NULLIF(p.selling_price, 0))
              ELSE NULLIF(p.selling_price, 0) END,
         'XAF'::text, v_org, v_kind
    FROM public.products p
   WHERE p.sku = ANY (public.xcape_retail_skus())
   ORDER BY array_position(public.xcape_retail_skus(), p.sku);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.xcape_set_default_price(_product_id uuid, _price numeric)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only XCAPE administration can change default prices'
      USING ERRCODE='insufficient_privilege';
  END IF;
  IF _price IS NULL OR _price <= 0 THEN
    RAISE EXCEPTION 'Enter a price greater than zero' USING ERRCODE='check_violation';
  END IF;
  UPDATE public.products SET selling_price = _price, updated_at = now()
   WHERE id = _product_id AND sku = ANY (public.xcape_retail_skus());
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Not an XCAPE retail product' USING ERRCODE='check_violation';
  END IF;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.xcape_set_org_price(_product_id uuid, _price numeric)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_org uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE='insufficient_privilege';
  END IF;
  SELECT o.id INTO v_org FROM public.organizations o
   WHERE o.id = public.primary_org_id(auth.uid())
     AND o.kind = 'cdp' AND o.status = 'active'
     AND public.is_org_member(o.id, auth.uid());
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'Only an active partner location can set its own prices'
      USING ERRCODE='insufficient_privilege';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.products p
                  WHERE p.id = _product_id AND p.sku = ANY (public.xcape_retail_skus())) THEN
    RAISE EXCEPTION 'Not an XCAPE retail product' USING ERRCODE='check_violation';
  END IF;

  IF _price IS NULL OR _price <= 0 THEN
    DELETE FROM public.organization_product_prices
     WHERE organization_id = v_org AND product_id = _product_id;
    RETURN;
  END IF;

  INSERT INTO public.organization_product_prices
    (organization_id, product_id, price, currency, active, created_by)
  VALUES (v_org, _product_id, _price, 'XAF', true, auth.uid())
  ON CONFLICT (organization_id, product_id)
  DO UPDATE SET price = EXCLUDED.price, currency = 'XAF', active = true, updated_at = now();
END;
$function$
;

CREATE OR REPLACE FUNCTION public.xcape_unit_price(_product_id uuid, _merchant_org uuid)
 RETURNS numeric
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT COALESCE(
    (
      SELECT opp.price
      FROM public.organization_product_prices opp
      JOIN public.organizations o ON o.id = opp.organization_id
      WHERE opp.organization_id = _merchant_org
        AND opp.product_id = _product_id
        AND opp.active IS TRUE
        AND opp.price > 0
        AND o.kind = 'cdp'
        AND o.status = 'active'
      LIMIT 1
    ),
    (
      SELECT p.selling_price
      FROM public.products p
      WHERE p.id = _product_id
        AND p.active IS TRUE
        AND p.selling_price > 0
      LIMIT 1
    ),
    0::numeric
  );
$function$
;

CREATE OR REPLACE FUNCTION public.xcape_update_commerce_settings(_commerce_enabled boolean, _order_contact_phone text DEFAULT NULL::text, _whatsapp_number text DEFAULT NULL::text, _momo_provider text DEFAULT NULL::text, _momo_recipient_number text DEFAULT NULL::text, _momo_recipient_name text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_org uuid := public.xcape_my_commerce_org();
  v_phone text := NULLIF(btrim(COALESCE(_order_contact_phone,'')), '');
  v_wa    text := NULLIF(btrim(COALESCE(_whatsapp_number,'')), '');
  v_prov  text := NULLIF(btrim(COALESCE(_momo_provider,'')), '');
  v_num   text := NULLIF(btrim(COALESCE(_momo_recipient_number,'')), '');
  v_nm    text := NULLIF(btrim(COALESCE(_momo_recipient_name,'')), '');
BEGIN
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'You cannot change commerce settings' USING ERRCODE='insufficient_privilege';
  END IF;
  IF COALESCE(_commerce_enabled, false) AND (v_prov IS NULL OR v_num IS NULL OR v_phone IS NULL) THEN
    RAISE EXCEPTION 'Add a Mobile Money provider, recipient number and contact phone before enabling ordering'
      USING ERRCODE='check_violation';
  END IF;
  IF v_num IS NOT NULL AND length(regexp_replace(v_num, '\D', '', 'g')) < 7 THEN
    RAISE EXCEPTION 'Mobile Money number is not valid' USING ERRCODE='check_violation';
  END IF;

  INSERT INTO public.xcape_commerce_settings AS s (
    organization_id, commerce_enabled, order_contact_phone, whatsapp_number,
    momo_provider, momo_recipient_number, momo_recipient_name, currency, updated_by)
  VALUES (v_org, COALESCE(_commerce_enabled,false), v_phone, v_wa, v_prov, v_num, v_nm, 'XAF', auth.uid())
  ON CONFLICT (organization_id) DO UPDATE SET
    commerce_enabled = EXCLUDED.commerce_enabled,
    order_contact_phone = EXCLUDED.order_contact_phone,
    whatsapp_number = EXCLUDED.whatsapp_number,
    momo_provider = EXCLUDED.momo_provider,
    momo_recipient_number = EXCLUDED.momo_recipient_number,
    momo_recipient_name = EXCLUDED.momo_recipient_name,
    currency = 'XAF',
    updated_by = auth.uid(),
    updated_at = now();

  RETURN public.xcape_get_commerce_settings();
END;
$function$
;

CREATE OR REPLACE FUNCTION public.xcape_verify_payment_claim(_claim_id uuid, _note text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_row public.xcape_report_payment_claims%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR NOT public.xcape_may_review_claim(_claim_id) THEN
    RAISE EXCEPTION 'You cannot review this payment'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT *
    INTO v_row
    FROM public.xcape_report_payment_claims
   WHERE id = _claim_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment claim not found'
      USING ERRCODE = 'no_data_found';
  END IF;

  IF v_row.status = 'verified' THEN
    RETURN jsonb_build_object(
      'ok', true,
      'order_ref', v_row.order_ref,
      'status', v_row.status,
      'already_verified', true
    );
  END IF;

  IF EXISTS (
    SELECT 1
      FROM public.pending_outreach_orders p
     WHERE p.report_payment_claim_id = _claim_id
       AND p.status = 'paid'
  ) THEN
    RAISE EXCEPTION 'A fulfilled payment cannot change verification state'
      USING ERRCODE = 'check_violation';
  END IF;

  IF v_row.status NOT IN ('submitted', 'rejected') THEN
    RAISE EXCEPTION 'This payment cannot be verified from its current state'
      USING ERRCODE = 'check_violation';
  END IF;

  UPDATE public.xcape_report_payment_claims
     SET status = 'verified',
         reviewed_by = auth.uid(),
         reviewed_at = now(),
         rejected_reason = NULL,
         updated_at = now()
   WHERE id = _claim_id
   RETURNING * INTO v_row;

  RETURN jsonb_build_object(
    'ok', true,
    'order_ref', v_row.order_ref,
    'status', v_row.status,
    'already_verified', false
  );
END;
$function$
;

-- ---------------- execute grants ----------------
REVOKE ALL ON FUNCTION public.can_read_org_scope(_org uuid, _user uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.can_read_org_scope(_org uuid, _user uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_read_org_scope(_org uuid, _user uuid) TO service_role;
REVOKE ALL ON FUNCTION public.stamp_order_commercial_context() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.stamp_order_commercial_context() TO service_role;
REVOKE ALL ON FUNCTION public.submit_report_momo_order(_report_token text, _items jsonb, _buyer_name text, _buyer_phone text, _sender_phone text, _amount_sent numeric, _buyer_email text, _notes text, _payment_reference text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_report_momo_order(_report_token text, _items jsonb, _buyer_name text, _buyer_phone text, _sender_phone text, _amount_sent numeric, _buyer_email text, _notes text, _payment_reference text) TO anon;
GRANT EXECUTE ON FUNCTION public.submit_report_momo_order(_report_token text, _items jsonb, _buyer_name text, _buyer_phone text, _sender_phone text, _amount_sent numeric, _buyer_email text, _notes text, _payment_reference text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_report_momo_order(_report_token text, _items jsonb, _buyer_name text, _buyer_phone text, _sender_phone text, _amount_sent numeric, _buyer_email text, _notes text, _payment_reference text) TO service_role;
REVOKE ALL ON FUNCTION public.xcape_build_report_commercial_snapshot(_link_id uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.xcape_build_report_commercial_snapshot(_link_id uuid) TO service_role;
REVOKE ALL ON FUNCTION public.xcape_fulfil_report_order(_claim_id uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.xcape_fulfil_report_order(_claim_id uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.xcape_fulfil_report_order(_claim_id uuid) TO service_role;
REVOKE ALL ON FUNCTION public.xcape_get_commerce_settings() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.xcape_get_commerce_settings() TO authenticated;
GRANT EXECUTE ON FUNCTION public.xcape_get_commerce_settings() TO service_role;
REVOKE ALL ON FUNCTION public.xcape_may_manage_pending_order(_pending_order_id uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.xcape_may_manage_pending_order(_pending_order_id uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.xcape_may_manage_pending_order(_pending_order_id uuid) TO service_role;
REVOKE ALL ON FUNCTION public.xcape_may_review_claim(_claim_id uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.xcape_may_review_claim(_claim_id uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.xcape_may_review_claim(_claim_id uuid) TO service_role;
REVOKE ALL ON FUNCTION public.xcape_my_commerce_org() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.xcape_my_commerce_org() TO authenticated;
GRANT EXECUTE ON FUNCTION public.xcape_my_commerce_org() TO service_role;
REVOKE ALL ON FUNCTION public.xcape_reject_payment_claim(_claim_id uuid, _reason text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.xcape_reject_payment_claim(_claim_id uuid, _reason text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.xcape_reject_payment_claim(_claim_id uuid, _reason text) TO service_role;
REVOKE ALL ON FUNCTION public.xcape_report_context(_token text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.xcape_report_context(_token text) TO service_role;
REVOKE ALL ON FUNCTION public.xcape_report_eligible_product(_assessment_id uuid, _product_id uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.xcape_report_eligible_product(_assessment_id uuid, _product_id uuid) TO service_role;
REVOKE ALL ON FUNCTION public.xcape_report_merchant_org(_token text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.xcape_report_merchant_org(_token text) TO service_role;
REVOKE ALL ON FUNCTION public.xcape_resolved_price(_org uuid, _product uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.xcape_resolved_price(_org uuid, _product uuid) TO service_role;
REVOKE ALL ON FUNCTION public.xcape_retail_price_book() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.xcape_retail_price_book() TO authenticated;
GRANT EXECUTE ON FUNCTION public.xcape_retail_price_book() TO service_role;
REVOKE ALL ON FUNCTION public.xcape_set_default_price(_product_id uuid, _price numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.xcape_set_default_price(_product_id uuid, _price numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.xcape_set_default_price(_product_id uuid, _price numeric) TO service_role;
REVOKE ALL ON FUNCTION public.xcape_set_org_price(_product_id uuid, _price numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.xcape_set_org_price(_product_id uuid, _price numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.xcape_set_org_price(_product_id uuid, _price numeric) TO service_role;
REVOKE ALL ON FUNCTION public.xcape_unit_price(_product_id uuid, _merchant_org uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.xcape_unit_price(_product_id uuid, _merchant_org uuid) TO service_role;
REVOKE ALL ON FUNCTION public.xcape_update_commerce_settings(_commerce_enabled boolean, _order_contact_phone text, _whatsapp_number text, _momo_provider text, _momo_recipient_number text, _momo_recipient_name text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.xcape_update_commerce_settings(_commerce_enabled boolean, _order_contact_phone text, _whatsapp_number text, _momo_provider text, _momo_recipient_number text, _momo_recipient_name text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.xcape_update_commerce_settings(_commerce_enabled boolean, _order_contact_phone text, _whatsapp_number text, _momo_provider text, _momo_recipient_number text, _momo_recipient_name text) TO service_role;
REVOKE ALL ON FUNCTION public.xcape_verify_payment_claim(_claim_id uuid, _note text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.xcape_verify_payment_claim(_claim_id uuid, _note text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.xcape_verify_payment_claim(_claim_id uuid, _note text) TO service_role;
