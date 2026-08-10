-- XCAPE customization protocol — data layer (additive only)

-- 1. Kit components: kit structure over the existing products catalogue
CREATE TABLE public.xcape_kit_components (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kit_product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  component_product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'component',
  is_customizable boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (kit_product_id, component_product_id)
);
GRANT SELECT ON public.xcape_kit_components TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.xcape_kit_components TO authenticated;
GRANT ALL ON public.xcape_kit_components TO service_role;
ALTER TABLE public.xcape_kit_components ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Practitioners read kit components" ON public.xcape_kit_components
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage kit components" ON public.xcape_kit_components
  FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE TRIGGER xcape_kit_components_touch BEFORE UPDATE ON public.xcape_kit_components
  FOR EACH ROW EXECUTE FUNCTION public.xcape_touch_updated_at();

-- 2. Category customization: category -> kit + base + active + companion mapping
CREATE TABLE public.xcape_category_customization (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL CHECK (category IN ('pigmentation_stability','barrier_surface_hydration','firmness_skin_support','oil_congestion_balance')),
  kit_product_id uuid REFERENCES public.products(id),
  base_product_id uuid REFERENCES public.products(id),
  active_product_id uuid REFERENCES public.products(id),
  aggressiveness text NOT NULL DEFAULT 'mild' CHECK (aggressiveness IN ('mild','aggressive')),
  companion_product_id uuid REFERENCES public.products(id),
  companion_ratio numeric NOT NULL DEFAULT 1.0,
  instructions text,
  warnings jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','archived')),
  is_demo boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (category)
);
GRANT SELECT ON public.xcape_category_customization TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.xcape_category_customization TO authenticated;
GRANT ALL ON public.xcape_category_customization TO service_role;
ALTER TABLE public.xcape_category_customization ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Practitioners read active customization" ON public.xcape_category_customization
  FOR SELECT TO authenticated USING (status = 'active');
CREATE POLICY "Admins manage customization" ON public.xcape_category_customization
  FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE TRIGGER xcape_category_customization_touch BEFORE UPDATE ON public.xcape_category_customization
  FOR EACH ROW EXECUTE FUNCTION public.xcape_touch_updated_at();

-- 3. Formula snapshots: immutable approved formula per assessment
CREATE TABLE public.xcape_formula_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id uuid NOT NULL REFERENCES public.client_visit_assessments(id) ON DELETE CASCADE,
  proposal_id uuid REFERENCES public.xcape_recommendation_proposals(id) ON DELETE SET NULL,
  client_id uuid NOT NULL REFERENCES public.clients(id),
  category text NOT NULL,
  score numeric,
  kit_product_id uuid REFERENCES public.products(id),
  kit_name text,
  kit_unit_price numeric,
  base_product_id uuid REFERENCES public.products(id),
  base_product_name text,
  active_product_id uuid REFERENCES public.products(id),
  active_name text,
  dose_ml numeric,
  companion_product_id uuid REFERENCES public.products(id),
  companion_name text,
  companion_dose_ml numeric,
  dose_tier jsonb,
  rule_id uuid,
  rule_version_id uuid,
  rule_version integer,
  instructions text,
  warnings jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed','approved','superseded','rejected')),
  override_note text,
  decision_reason text,
  is_demo boolean NOT NULL DEFAULT false,
  created_by uuid,
  approved_by uuid,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.xcape_formula_snapshots TO authenticated;
GRANT ALL ON public.xcape_formula_snapshots TO service_role;
ALTER TABLE public.xcape_formula_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read formula snapshots" ON public.xcape_formula_snapshots
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff create formula snapshots" ON public.xcape_formula_snapshots
  FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
CREATE POLICY "Creators and admins update formula snapshots" ON public.xcape_formula_snapshots
  FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR public.is_admin(auth.uid()))
  WITH CHECK (created_by = auth.uid() OR public.is_admin(auth.uid()));
CREATE TRIGGER xcape_formula_snapshots_touch BEFORE UPDATE ON public.xcape_formula_snapshots
  FOR EACH ROW EXECUTE FUNCTION public.xcape_touch_updated_at();

-- 4. Order lines retain the approved formula
ALTER TABLE public.pending_outreach_orders
  ADD COLUMN IF NOT EXISTS formula_snapshot_id uuid REFERENCES public.xcape_formula_snapshots(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS formula_summary jsonb;

-- 5. Staff-side single-product order gains an optional formula reference
CREATE OR REPLACE FUNCTION public.create_pending_outreach_order(_outreach_id uuid, _product_id uuid, _quantity numeric, _unit_price numeric, _customer_phone text, _customer_name text DEFAULT NULL::text, _attributed_staff_id uuid DEFAULT NULL::uuid, _payment_method text DEFAULT 'bank_transfer'::text, _payment_reference text DEFAULT NULL::text, _notes text DEFAULT NULL::text, _formula_snapshot_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_session public.outreach_sessions%ROWTYPE;
  v_phone_digits text;
  v_product_active boolean;
  v_client_id uuid;
  v_id uuid;
  v_attributed uuid;
  v_fs public.xcape_formula_snapshots%ROWTYPE;
  v_formula_summary jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE='insufficient_privilege';
  END IF;
  IF _product_id IS NULL THEN RAISE EXCEPTION 'product_id required'; END IF;
  IF _quantity IS NULL OR _quantity <= 0 THEN
    RAISE EXCEPTION 'Quantity must be greater than zero' USING ERRCODE='check_violation';
  END IF;
  IF _unit_price IS NULL OR _unit_price < 0 THEN
    RAISE EXCEPTION 'Unit price must be zero or greater' USING ERRCODE='check_violation';
  END IF;
  IF _customer_phone IS NULL THEN
    RAISE EXCEPTION 'Customer phone required' USING ERRCODE='check_violation';
  END IF;
  v_phone_digits := regexp_replace(_customer_phone, '\D', '', 'g');
  IF length(v_phone_digits) < 7 OR length(v_phone_digits) > 15 THEN
    RAISE EXCEPTION 'Customer phone is not a valid number' USING ERRCODE='check_violation';
  END IF;
  IF _payment_method IS NOT NULL
     AND _payment_method NOT IN ('cash','bank_transfer','pos','online') THEN
    RAISE EXCEPTION 'Invalid payment_method: %', _payment_method USING ERRCODE='check_violation';
  END IF;

  IF _outreach_id IS NOT NULL THEN
    SELECT * INTO v_session FROM public.outreach_sessions WHERE id = _outreach_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Outreach session not found' USING ERRCODE='no_data_found';
    END IF;
    IF v_session.status NOT IN ('active','completed') THEN
      RAISE EXCEPTION 'Outreach is %, pending orders only allowed while active or completed', v_session.status
        USING ERRCODE='check_violation';
    END IF;
  END IF;

  SELECT active INTO v_product_active FROM public.products WHERE id = _product_id;
  IF v_product_active IS NULL THEN
    RAISE EXCEPTION 'Product not found' USING ERRCODE='no_data_found';
  END IF;
  IF v_product_active = false THEN
    RAISE EXCEPTION 'Product is inactive' USING ERRCODE='check_violation';
  END IF;

  -- Server-authoritative formula copy: snapshot must be approved and belong
  -- to the kit being ordered. Callers can never inject formula content.
  IF _formula_snapshot_id IS NOT NULL THEN
    SELECT * INTO v_fs FROM public.xcape_formula_snapshots WHERE id = _formula_snapshot_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Formula snapshot not found' USING ERRCODE='no_data_found';
    END IF;
    IF v_fs.status <> 'approved' THEN
      RAISE EXCEPTION 'Formula is not approved' USING ERRCODE='check_violation';
    END IF;
    IF v_fs.kit_product_id IS DISTINCT FROM _product_id THEN
      RAISE EXCEPTION 'Formula does not match the ordered product' USING ERRCODE='check_violation';
    END IF;
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
      'copied_at', now()
    );
  END IF;

  v_attributed := COALESCE(_attributed_staff_id, auth.uid());

  SELECT id INTO v_client_id
    FROM public.clients
   WHERE phone IS NOT NULL
     AND regexp_replace(phone, '\D','','g') = v_phone_digits
     AND COALESCE(archived, false) = false
   ORDER BY created_at ASC
   LIMIT 1;

  INSERT INTO public.pending_outreach_orders (
    outreach_id, product_id, quantity, unit_price,
    customer_phone, customer_name, customer_client_id,
    attributed_staff_id, payment_method, payment_reference, notes,
    created_by, formula_snapshot_id, formula_summary
  ) VALUES (
    _outreach_id, _product_id, _quantity, _unit_price,
    _customer_phone, NULLIF(trim(COALESCE(_customer_name, '')), ''), v_client_id,
    v_attributed, _payment_method,
    NULLIF(trim(COALESCE(_payment_reference, '')), ''),
    NULLIF(trim(COALESCE(_notes, '')), ''),
    auth.uid(), _formula_snapshot_id, v_formula_summary
  ) RETURNING id INTO v_id;

  RETURN jsonb_build_object(
    'pending_order_id', v_id,
    'matched_client_id', v_client_id,
    'total_amount', ROUND(_quantity * _unit_price, 2)
  );
END;
$function$;

-- 6. Public cart order: per-item formula_snapshot_id, validated and copied server-side
CREATE OR REPLACE FUNCTION public.submit_public_cart_order(_items jsonb, _customer_phone text, _customer_name text, _customer_email text DEFAULT NULL::text, _order_ref text DEFAULT NULL::text, _referral_staff_id uuid DEFAULT NULL::uuid, _outreach_id uuid DEFAULT NULL::uuid, _attributed_staff_id uuid DEFAULT NULL::uuid, _notes text DEFAULT NULL::text, _delivery_method text DEFAULT 'pickup'::text, _delivery_address text DEFAULT NULL::text, _promo_code text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_phone_digits text;
  v_name text;
  v_client_id uuid;
  v_item jsonb;
  v_pid uuid;
  v_qty numeric;
  v_product public.products%ROWTYPE;
  v_unit_price numeric;
  v_subtotal numeric := 0;
  v_count int := 0;
  v_ref text;
  v_attrib_staff uuid;
  v_settings jsonb;
  v_enabled boolean;
  v_pickup_enabled boolean;
  v_flat_fee numeric;
  v_free_threshold numeric;
  v_method text;
  v_address text;
  v_delivery_fee numeric := 0;
  v_grand_total numeric;
  v_snapshot jsonb;
  v_promo_input text;
  v_promo jsonb;
  v_promo_ok boolean := false;
  v_promo_code_norm text := NULL;
  v_promo_staff_id uuid := NULL;
  v_promo_staff_name text := NULL;
  v_promo_pct numeric := 0;
  v_promo_amt numeric := 0;
  v_first_order_id uuid;
  v_formula_id uuid;
  v_fs public.xcape_formula_snapshots%ROWTYPE;
  v_formula_summary jsonb;
BEGIN
  IF _items IS NULL OR jsonb_typeof(_items) <> 'array' OR jsonb_array_length(_items) = 0 THEN
    RAISE EXCEPTION 'Cart is empty' USING ERRCODE='check_violation';
  END IF;
  IF _customer_phone IS NULL THEN
    RAISE EXCEPTION 'Customer phone required' USING ERRCODE='check_violation';
  END IF;
  v_phone_digits := regexp_replace(_customer_phone, '\D', '', 'g');
  IF length(v_phone_digits) < 7 OR length(v_phone_digits) > 15 THEN
    RAISE EXCEPTION 'Customer phone is not a valid number' USING ERRCODE='check_violation';
  END IF;
  v_name := NULLIF(trim(COALESCE(_customer_name, '')), '');
  IF v_name IS NULL OR length(v_name) < 2 THEN
    RAISE EXCEPTION 'Customer name required' USING ERRCODE='check_violation';
  END IF;

  SELECT value INTO v_settings FROM public.site_settings WHERE key = 'delivery';
  IF v_settings IS NULL THEN
    v_settings := jsonb_build_object(
      'enabled', false, 'fee', 0, 'free_threshold', null,
      'pickup_enabled', true, 'label', 'Delivery fee', 'note', ''
    );
  END IF;
  v_enabled        := COALESCE((v_settings->>'enabled')::boolean, false);
  v_pickup_enabled := COALESCE((v_settings->>'pickup_enabled')::boolean, true);
  v_flat_fee       := COALESCE((v_settings->>'fee')::numeric, 0);
  v_free_threshold := NULLIF(v_settings->>'free_threshold','')::numeric;

  v_method  := lower(COALESCE(NULLIF(trim(COALESCE(_delivery_method,'')), ''), 'pickup'));
  v_address := NULLIF(trim(COALESCE(_delivery_address, '')), '');

  IF v_method NOT IN ('delivery','pickup') THEN
    RAISE EXCEPTION 'Invalid delivery method' USING ERRCODE='check_violation';
  END IF;
  IF v_method = 'pickup' AND NOT v_pickup_enabled AND v_enabled THEN
    v_method := 'delivery';
  END IF;
  IF v_method = 'delivery' AND (v_address IS NULL OR length(v_address) < 5) THEN
    RAISE EXCEPTION 'Delivery address required' USING ERRCODE='check_violation';
  END IF;

  -- Validate promo code (server-side, never trust caller)
  v_promo_input := NULLIF(BTRIM(COALESCE(_promo_code, '')), '');
  IF v_promo_input IS NOT NULL THEN
    v_promo := public.validate_public_promo_code(v_promo_input);
    IF COALESCE((v_promo->>'ok')::boolean, false) THEN
      v_promo_ok := true;
      v_promo_code_norm := v_promo->>'code';
      v_promo_staff_id := NULLIF(v_promo->>'staff_id','')::uuid;
      v_promo_staff_name := v_promo->>'staff_name';
      v_promo_pct := COALESCE((v_promo->>'discount_pct')::numeric, 0);
    ELSE
      RAISE EXCEPTION 'promo_%', COALESCE(v_promo->>'error','invalid_promo_code') USING ERRCODE='check_violation';
    END IF;
  END IF;

  v_ref := COALESCE(NULLIF(trim(COALESCE(_order_ref, '')), ''),
    'TRP-' || to_char(now(), 'YYMMDD') || '-' || upper(substr(md5(random()::text), 1, 6)));
  -- Promo staff attribution wins only when no explicit referral/attribution is provided.
  v_attrib_staff := COALESCE(_attributed_staff_id, _referral_staff_id, v_promo_staff_id);

  SELECT id INTO v_client_id
    FROM public.clients
   WHERE phone IS NOT NULL
     AND regexp_replace(phone, '\D','','g') = v_phone_digits
     AND COALESCE(archived, false) = false
   ORDER BY created_at ASC
   LIMIT 1;

  IF v_client_id IS NULL THEN
    INSERT INTO public.clients (
      full_name, phone, email, source_type, status, captured_via,
      attributed_staff_id, outreach_id,
      acquisition_owner_id, original_source, acquisition_locked, first_seen_at
    ) VALUES (
      v_name,
      _customer_phone,
      NULLIF(trim(COALESCE(_customer_email, '')), ''),
      CASE WHEN _outreach_id IS NOT NULL THEN 'outreach'
           WHEN _referral_staff_id IS NOT NULL OR v_promo_staff_id IS NOT NULL THEN 'referral'
           ELSE 'website' END,
      'lead',
      CASE WHEN _outreach_id IS NOT NULL THEN 'outreach' ELSE 'website' END,
      COALESCE(_referral_staff_id, v_promo_staff_id),
      _outreach_id,
      COALESCE(_referral_staff_id, v_promo_staff_id),
      'website_product_order',
      (_outreach_id IS NOT NULL OR _referral_staff_id IS NOT NULL OR v_promo_staff_id IS NOT NULL),
      now()
    )
    RETURNING id INTO v_client_id;
  END IF;

  -- First pass: compute subtotal from server-authoritative product prices.
  FOR v_item IN SELECT * FROM jsonb_array_elements(_items)
  LOOP
    v_pid := NULLIF(v_item->>'product_id','')::uuid;
    v_qty := COALESCE((v_item->>'quantity')::numeric, 0);
    IF v_pid IS NULL OR v_qty <= 0 THEN
      RAISE EXCEPTION 'Invalid cart item' USING ERRCODE='check_violation';
    END IF;
    SELECT * INTO v_product FROM public.products WHERE id = v_pid;
    IF NOT FOUND THEN RAISE EXCEPTION 'Product not found' USING ERRCODE='no_data_found'; END IF;
    IF v_product.active = false OR COALESCE(v_product.public_visible, false) = false THEN
      RAISE EXCEPTION 'Product unavailable: %', v_product.name USING ERRCODE='check_violation';
    END IF;
    v_unit_price := COALESCE(v_product.promo_price, v_product.market_price, v_product.selling_price, 0);
    IF v_unit_price <= 0 THEN
      RAISE EXCEPTION 'Product has no price: %', v_product.name USING ERRCODE='check_violation';
    END IF;
    v_subtotal := v_subtotal + (v_qty * v_unit_price);
  END LOOP;

  -- Delivery fee from settings.
  IF v_enabled AND v_method = 'delivery' THEN
    IF v_free_threshold IS NOT NULL AND v_subtotal >= v_free_threshold THEN
      v_delivery_fee := 0;
    ELSE
      v_delivery_fee := GREATEST(v_flat_fee, 0);
    END IF;
  ELSE
    v_delivery_fee := 0;
  END IF;

  -- Promo discount computed on product subtotal (delivery never discounted).
  IF v_promo_ok THEN
    v_promo_amt := ROUND(v_subtotal * v_promo_pct / 100.0, 2);
  END IF;

  v_grand_total := ROUND(GREATEST(0, v_subtotal - v_promo_amt) + v_delivery_fee, 2);

  v_snapshot := jsonb_build_object(
    'enabled', v_enabled,
    'pickup_enabled', v_pickup_enabled,
    'flat_fee', v_flat_fee,
    'free_threshold', v_free_threshold,
    'label', COALESCE(v_settings->>'label','Delivery fee'),
    'note',  COALESCE(v_settings->>'note',''),
    'computed_fee', v_delivery_fee,
    'computed_at', now()
  );

  -- Second pass: insert order rows.
  FOR v_item IN SELECT * FROM jsonb_array_elements(_items)
  LOOP
    v_pid := (v_item->>'product_id')::uuid;
    v_qty := (v_item->>'quantity')::numeric;
    SELECT * INTO v_product FROM public.products WHERE id = v_pid;
    v_unit_price := COALESCE(v_product.promo_price, v_product.market_price, v_product.selling_price, 0);

    -- Optional approved formula, validated and copied server-side.
    v_formula_id := NULLIF(v_item->>'formula_snapshot_id','')::uuid;
    v_formula_summary := NULL;
    IF v_formula_id IS NOT NULL THEN
      SELECT * INTO v_fs FROM public.xcape_formula_snapshots WHERE id = v_formula_id;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'Formula snapshot not found' USING ERRCODE='no_data_found';
      END IF;
      IF v_fs.status <> 'approved' THEN
        RAISE EXCEPTION 'Formula is not approved' USING ERRCODE='check_violation';
      END IF;
      IF v_fs.kit_product_id IS DISTINCT FROM v_pid THEN
        RAISE EXCEPTION 'Formula does not match the ordered product' USING ERRCODE='check_violation';
      END IF;
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
        'copied_at', now()
      );
    END IF;

    INSERT INTO public.pending_outreach_orders (
      outreach_id, product_id, quantity, unit_price,
      customer_phone, customer_name, customer_client_id,
      attributed_staff_id, payment_method, notes, order_ref,
      delivery_method, delivery_fee, delivery_address, delivery_settings_snapshot,
      promo_code, promo_discount_pct, promo_discount_amount, promo_staff_id,
      formula_snapshot_id, formula_summary
    ) VALUES (
      _outreach_id, v_pid, v_qty, v_unit_price,
      _customer_phone, v_name, v_client_id,
      v_attrib_staff, 'bank_transfer',
      '[ref:' || v_ref || '] Public website cart order'
        || COALESCE(' — ' || NULLIF(trim(COALESCE(_notes, '')), ''), '')
        || CASE WHEN v_promo_ok THEN ' — promo ' || v_promo_code_norm || ' (' || v_promo_pct || '% off)' ELSE '' END,
      v_ref,
      v_method,
      CASE WHEN v_count = 0 THEN v_delivery_fee ELSE 0 END,
      v_address,
      v_snapshot,
      v_promo_code_norm,
      CASE WHEN v_promo_ok THEN v_promo_pct ELSE NULL END,
      -- record entire promo discount on the first row only so summing lines does not double-count.
      CASE WHEN v_promo_ok AND v_count = 0 THEN v_promo_amt ELSE NULL END,
      v_promo_staff_id,
      v_formula_id, v_formula_summary
    )
    RETURNING id INTO v_first_order_id;
    v_count := v_count + 1;
  END LOOP;

  -- Log redemption once for the whole order.
  IF v_promo_ok AND v_promo_staff_id IS NOT NULL AND v_promo_amt > 0 THEN
    BEGIN
      INSERT INTO public.promo_code_redemptions (
        staff_user_id, promo_code_snapshot, client_id,
        discount_pct_applied, discount_amount, gross_amount, net_amount,
        source, notes
      ) VALUES (
        v_promo_staff_id, v_promo_code_norm, v_client_id,
        v_promo_pct, v_promo_amt, v_subtotal, GREATEST(0, v_subtotal - v_promo_amt),
        'checkout',
        'Website order ' || v_ref
      );
    EXCEPTION WHEN OTHERS THEN
      -- redemption logging must never break the order
      NULL;
    END;
  END IF;

  RETURN jsonb_build_object(
    'order_ref', v_ref,
    'client_id', v_client_id,
    'subtotal', ROUND(v_subtotal, 2),
    'delivery_fee', ROUND(v_delivery_fee, 2),
    'delivery_method', v_method,
    'total_amount', v_grand_total,
    'item_count', v_count,
    'promo', CASE WHEN v_promo_ok THEN
      jsonb_build_object(
        'code', v_promo_code_norm,
        'discount_pct', v_promo_pct,
        'discount_amount', v_promo_amt,
        'staff_name', v_promo_staff_name
      )
      ELSE NULL END
  );
END;
$function$;