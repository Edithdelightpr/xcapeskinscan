CREATE OR REPLACE FUNCTION public.submit_report_momo_order(
  _report_token text,
  _items jsonb,
  _buyer_name text,
  _buyer_phone text,
  _sender_phone text,
  _amount_sent numeric,
  _buyer_email text DEFAULT NULL::text,
  _notes text DEFAULT NULL::text,
  _payment_reference text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_ctx jsonb; v_merchant uuid; v_assessment uuid; v_link uuid; v_client uuid;
  v_set public.xcape_commerce_settings%ROWTYPE;
  v_item jsonb; v_pid uuid; v_qty numeric; v_price numeric; v_fid uuid;
  v_total numeric := 0; v_count int := 0; v_ref text;
  v_name text; v_phone text; v_sender text; v_amount numeric;
  v_claim uuid; v_contact jsonb; v_product public.products%ROWTYPE;
  v_fs public.xcape_formula_snapshots%ROWTYPE;
  v_formula_summary jsonb; v_label text;
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

  FOR v_item IN SELECT * FROM jsonb_array_elements(_items) LOOP
    v_pid := NULLIF(v_item->>'product_id','')::uuid;
    v_fid := NULLIF(v_item->>'formula_snapshot_id','')::uuid;
    v_qty := FLOOR(COALESCE((v_item->>'quantity')::numeric, 0));
    IF v_pid IS NULL OR v_qty <= 0 OR v_qty > 50 THEN
      RAISE EXCEPTION 'Invalid order item' USING ERRCODE='check_violation';
    END IF;

    IF v_fid IS NOT NULL THEN
      SELECT * INTO v_fs FROM public.xcape_formula_snapshots WHERE id = v_fid;
      IF NOT FOUND
         OR v_fs.assessment_id IS DISTINCT FROM v_assessment
         OR v_fs.status <> 'approved'
         OR COALESCE(v_fs.is_demo, false)
         OR v_fs.kit_product_id IS DISTINCT FROM v_pid THEN
        RAISE EXCEPTION 'This customized formula is not part of that report.'
          USING ERRCODE='22023', HINT='formula_not_on_report';
      END IF;
    ELSIF NOT EXISTS (
      SELECT 1 FROM public.client_visit_assessments a,
        LATERAL jsonb_array_elements(
          CASE WHEN jsonb_typeof(a.recommended_products) = 'array'
               THEN a.recommended_products ELSE '[]'::jsonb END) r
       WHERE a.id = v_assessment
         AND COALESCE(NULLIF(r->>'product_id',''), NULLIF(r->>'id','')) = v_pid::text
    ) THEN
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

  FOR v_item IN SELECT * FROM jsonb_array_elements(_items) LOOP
    v_pid := (v_item->>'product_id')::uuid;
    v_fid := NULLIF(v_item->>'formula_snapshot_id','')::uuid;
    v_qty := FLOOR((v_item->>'quantity')::numeric);
    v_price := public.xcape_unit_price(v_pid, v_merchant);
    SELECT * INTO v_product FROM public.products WHERE id = v_pid;
    v_formula_summary := NULL;
    v_label := NULL;

    IF v_fid IS NOT NULL THEN
      SELECT * INTO v_fs FROM public.xcape_formula_snapshots WHERE id = v_fid;
      v_formula_summary := jsonb_build_object(
        'snapshot_id', v_fs.id,
        'category', v_fs.category,
        'score', v_fs.score,
        'base_product_id', v_fs.base_product_id,
        'base_product_name', v_fs.base_product_name,
        'active_product_id', v_fs.active_product_id,
        'active_name', v_fs.active_name,
        'dose_ml', v_fs.dose_ml,
        'companion_product_id', v_fs.companion_product_id,
        'companion_name', v_fs.companion_name,
        'companion_dose_ml', v_fs.companion_dose_ml,
        'instructions', v_fs.instructions,
        'warnings', v_fs.warnings,
        'rule_id', v_fs.rule_id,
        'rule_version_id', v_fs.rule_version_id,
        'rule_version', v_fs.rule_version,
        'copied_at', now());
      v_label := COALESCE(v_fs.active_name, 'Customized')
                 || COALESCE(' - ' || v_fs.dose_ml::text || ' ml', '');
    END IF;

    INSERT INTO public.pending_outreach_orders (
      product_id, quantity, unit_price, customer_phone, customer_name,
      customer_client_id, payment_method, payment_reference, notes, order_ref,
      delivery_method, status, report_link_id, report_payment_claim_id,
      origin_user_id, origin_role, origin_org_id, fulfilment_org_id,
      formula_snapshot_id, formula_summary, price_snapshot)
    VALUES (
      v_pid, v_qty, v_price, v_phone, v_name,
      v_client, 'online',
      LEFT(NULLIF(btrim(COALESCE(_payment_reference,'')), ''), 120),
      '[ref:' || v_ref || '] XCAPE report order (Mobile Money - awaiting verification)'
        || COALESCE(' - ' || NULLIF(btrim(COALESCE(_notes,'')), ''), ''),
      v_ref, 'pickup', 'pending', v_link, v_claim,
      NULLIF(v_ctx->>'created_by','')::uuid,
      v_ctx->>'origin_role',
      NULLIF(v_ctx->>'origin_org_id','')::uuid,
      v_merchant,
      v_fid, v_formula_summary,
      jsonb_build_object(
        'product_id', v_pid,
        'product_name', v_product.name,
        'formula_snapshot_id', v_fid,
        'formula_label', v_label,
        'unit_price', v_price, 'quantity', v_qty,
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
$function$;

REVOKE ALL ON FUNCTION public.submit_report_momo_order(text, jsonb, text, text, text, numeric, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_report_momo_order(text, jsonb, text, text, text, numeric, text, text, text) TO anon, authenticated, service_role;