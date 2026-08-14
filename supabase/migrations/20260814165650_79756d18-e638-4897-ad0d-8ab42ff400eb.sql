-- 1. Canonical, country-aware phone key -------------------------------------
CREATE OR REPLACE FUNCTION public.xcape_phone_key(_raw text, _default_dial text DEFAULT '234')
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO ''
AS $$
DECLARE
  v_raw      text := btrim(coalesce(_raw, ''));
  v_d        text;
  v_explicit boolean := false;
  v_dial     text := regexp_replace(coalesce(_default_dial, '234'), '\D', '', 'g');
  v_codes    text[] := ARRAY[
    '234','233','254','237','225','221','255','256','250','971','966','974',
    '27','20','44','90','33','49','39','34','31','91','86','61','55','1'
  ];
  v_code  text;
  v_found boolean := false;
BEGIN
  IF v_raw = '' THEN RETURN ''; END IF;
  IF v_dial = '' THEN v_dial := '234'; END IF;

  v_explicit := left(v_raw, 1) = '+';
  v_d := regexp_replace(v_raw, '\D', '', 'g');
  IF v_d = '' THEN RETURN ''; END IF;

  IF NOT v_explicit AND left(v_d, 2) = '00' THEN
    v_d := substr(v_d, 3);
    v_explicit := true;
  END IF;

  IF NOT v_explicit THEN
    IF length(ltrim(v_d, '0')) < 7 THEN RETURN ''; END IF;
    IF left(v_d, 1) = '0' THEN
      v_d := v_dial || ltrim(v_d, '0');
    ELSE
      FOREACH v_code IN ARRAY v_codes LOOP
        IF left(v_d, length(v_code)) = v_code AND length(v_d) - length(v_code) >= 6 THEN
          v_found := true;
          EXIT;
        END IF;
      END LOOP;
      IF NOT v_found THEN v_d := v_dial || v_d; END IF;
    END IF;
  END IF;

  IF length(v_d) < 8 OR length(v_d) > 15 THEN RETURN ''; END IF;
  RETURN '+' || v_d;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.xcape_phone_key(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.xcape_phone_key(text, text) TO authenticated, service_role;

-- 2. Stored canonical phone on clients ---------------------------------------
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS normalized_phone text;

CREATE OR REPLACE FUNCTION public.tg_clients_normalize_phone()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  NEW.normalized_phone := nullif(public.xcape_phone_key(NEW.phone), '');
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.tg_clients_normalize_phone() FROM PUBLIC, anon;

DROP TRIGGER IF EXISTS trg_clients_normalize_phone ON public.clients;
CREATE TRIGGER trg_clients_normalize_phone
BEFORE INSERT OR UPDATE OF phone ON public.clients
FOR EACH ROW EXECUTE FUNCTION public.tg_clients_normalize_phone();

-- Backfill. Non-unique index: historical duplicates stay exactly as they are.
UPDATE public.clients
   SET normalized_phone = nullif(public.xcape_phone_key(phone), '')
 WHERE phone IS NOT NULL
   AND normalized_phone IS DISTINCT FROM nullif(public.xcape_phone_key(phone), '');

CREATE INDEX IF NOT EXISTS clients_normalized_phone_idx
  ON public.clients (normalized_phone)
  WHERE normalized_phone IS NOT NULL;

-- 3. Cross-operator identity lookup: canonical key + masked name -------------
CREATE OR REPLACE FUNCTION public.xcape_lookup_client_by_phone(_phone text)
RETURNS TABLE(id uuid, full_name text, phone_masked text, created_at timestamp with time zone, assessment_count integer, already_accessible boolean)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_key    text := public.xcape_phone_key(_phone);
  v_legacy text := public.xcape_normalise_phone(_phone);
BEGIN
  IF auth.uid() IS NULL OR length(v_legacy) < 7 THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH candidates AS (
    SELECT c.*,
           (c.origin_user_id = auth.uid()
            OR (c.origin_org_id IS NOT NULL AND public.can_read_org_scope(c.origin_org_id, auth.uid()))
            OR public.has_client_touchpoint(c.id, auth.uid())) AS accessible
      FROM public.clients c
     WHERE c.phone IS NOT NULL
       AND (
         (v_key <> '' AND c.normalized_phone = v_key)
         OR public.xcape_normalise_phone(c.phone) = v_legacy
       )
  )
  SELECT cd.id,
         -- A partner who cannot access the record only ever sees enough to
         -- recognise their own walk-in, never another partner's client list.
         CASE
           WHEN cd.accessible THEN cd.full_name
           ELSE split_part(btrim(cd.full_name), ' ', 1) ||
                CASE
                  WHEN position(' ' IN btrim(cd.full_name)) > 0
                    THEN ' ' || upper(left(split_part(btrim(cd.full_name), ' ', 2), 1)) || '.'
                  ELSE ''
                END
         END,
         '••• ' || right(v_legacy, 4),
         cd.created_at,
         (SELECT count(*)::int FROM public.client_visit_assessments a WHERE a.client_id = cd.id),
         cd.accessible
    FROM candidates cd
   ORDER BY cd.created_at
   LIMIT 5;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.xcape_lookup_client_by_phone(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.xcape_lookup_client_by_phone(text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.xcape_reuse_client(_client_id uuid, _phone text)
RETURNS clients
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_row    public.clients;
  v_key    text := public.xcape_phone_key(_phone);
  v_legacy text := public.xcape_normalise_phone(_phone);
BEGIN
  IF auth.uid() IS NULL OR length(v_legacy) < 7 THEN
    RAISE EXCEPTION 'A valid phone number is required to continue with an existing client';
  END IF;

  SELECT * INTO v_row
    FROM public.clients c
   WHERE c.id = _client_id
     AND c.phone IS NOT NULL
     AND (
       (v_key <> '' AND c.normalized_phone = v_key)
       OR public.xcape_normalise_phone(c.phone) = v_legacy
     );

  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'No matching client for that phone number';
  END IF;

  RETURN v_row;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.xcape_reuse_client(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.xcape_reuse_client(uuid, text) TO authenticated, service_role;

-- 4. One origin trigger + one commercial-context trigger, in that order ------
DROP TRIGGER IF EXISTS stamp_fulfilment_orders  ON public.pending_outreach_orders;
DROP TRIGGER IF EXISTS stamp_fulfilment_orders2 ON public.pending_outreach_orders;

CREATE OR REPLACE FUNCTION public.stamp_order_commercial_context()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_kind  text;
  v_token text;
  v_link  public.client_report_links%ROWTYPE;
BEGIN
  -- Report-sourced anonymous checkout inherits its attribution from the share
  -- link itself. auth.uid() is NULL for the buyer, so the verified token is the
  -- only trustworthy source — the client never supplies origin ids.
  IF NEW.origin_user_id IS NULL OR NEW.origin_org_id IS NULL THEN
    v_token := NULLIF(current_setting('xcape.report_token', true), '');
    IF v_token IS NOT NULL THEN
      SELECT * INTO v_link
        FROM public.client_report_links
       WHERE token_hash = encode(sha256(convert_to(btrim(v_token), 'utf8')), 'hex')
       LIMIT 1;
      -- A NULL expiry means "persistent link" and must stay attributable.
      IF FOUND
         AND v_link.revoked_at IS NULL
         AND (v_link.expires_at IS NULL OR v_link.expires_at > now()) THEN
        NEW.report_link_id     := COALESCE(NEW.report_link_id, v_link.id);
        NEW.customer_client_id := COALESCE(NEW.customer_client_id, v_link.client_id);
        -- client_report_links tracks its creator as created_by; that operator
        -- is the origin of every sale made from the link they shared.
        NEW.origin_user_id     := COALESCE(NEW.origin_user_id, v_link.created_by);
        NEW.origin_org_id      := COALESCE(v_link.origin_org_id, NEW.origin_org_id);
        IF NEW.origin_role IS NULL AND v_link.created_by IS NOT NULL THEN
          NEW.origin_role := CASE
            WHEN public.has_role(v_link.created_by, 'admin')     THEN 'admin'
            WHEN public.has_role(v_link.created_by, 'cdp')       THEN 'cdp'
            WHEN public.has_role(v_link.created_by, 'affiliate') THEN 'affiliate'
            ELSE 'staff'
          END;
        END IF;
      END IF;
    END IF;
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

-- 5. Defense in depth: the outreach read rule is for signed-in users only ----
DROP POLICY IF EXISTS "Outreach staff view outreach-captured clients" ON public.clients;
CREATE POLICY "Outreach staff view outreach-captured clients"
ON public.clients
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'outreach') AND outreach_id IS NOT NULL);