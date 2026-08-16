CREATE TABLE IF NOT EXISTS public.xcape_customization_usage_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  formula_snapshot_id uuid NOT NULL UNIQUE REFERENCES public.xcape_formula_snapshots(id) ON DELETE CASCADE,
  assessment_id uuid NOT NULL,
  client_id uuid NOT NULL,
  cdp_org_id uuid NOT NULL,
  cdp_org_name text,
  category text NOT NULL,
  kit_product_id uuid,
  kit_name text,
  base_product_id uuid,
  base_product_name text,
  active_product_id uuid,
  active_name text,
  dose_ml numeric,
  companion_product_id uuid,
  companion_name text,
  companion_dose_ml numeric,
  formula_lines jsonb NOT NULL DEFAULT '[]'::jsonb,
  rule_id uuid,
  rule_version_id uuid,
  rule_version integer,
  protocol_version text,
  recommendation_rule_version integer,
  product_catalogue_version text,
  approved_by uuid,
  approved_at timestamptz,
  captured_by uuid,
  recorded_at timestamptz NOT NULL DEFAULT now()
);

REVOKE ALL ON public.xcape_customization_usage_events FROM PUBLIC;
REVOKE ALL ON public.xcape_customization_usage_events FROM anon;
REVOKE ALL ON public.xcape_customization_usage_events FROM authenticated;
GRANT SELECT ON public.xcape_customization_usage_events TO service_role;

ALTER TABLE public.xcape_customization_usage_events ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_xcape_cust_usage_org_date
  ON public.xcape_customization_usage_events (cdp_org_id, approved_at);
CREATE INDEX IF NOT EXISTS idx_xcape_cust_usage_kit_active
  ON public.xcape_customization_usage_events (kit_product_id, active_product_id, category);
CREATE INDEX IF NOT EXISTS idx_xcape_cust_usage_recorded_at
  ON public.xcape_customization_usage_events (recorded_at);

CREATE OR REPLACE FUNCTION public.xcape_capture_customization_usage()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_assessment record;
  v_org record;
BEGIN
  IF NEW.status IS DISTINCT FROM 'approved' OR COALESCE(NEW.is_demo, false) THEN
    RETURN NEW;
  END IF;

  SELECT a.id, a.client_id, a.origin_role, a.origin_org_id
    INTO v_assessment
  FROM public.client_visit_assessments a
  WHERE a.id = NEW.assessment_id;

  IF NOT FOUND OR v_assessment.origin_role IS DISTINCT FROM 'cdp' OR v_assessment.origin_org_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT o.id, o.name, o.kind, o.status INTO v_org
  FROM public.organizations o
  WHERE o.id = v_assessment.origin_org_id;

  IF NOT FOUND OR v_org.kind IS DISTINCT FROM 'cdp' THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.xcape_customization_usage_events (
    formula_snapshot_id, assessment_id, client_id, cdp_org_id, cdp_org_name,
    category, kit_product_id, kit_name, base_product_id, base_product_name,
    active_product_id, active_name, dose_ml,
    companion_product_id, companion_name, companion_dose_ml,
    formula_lines, rule_id, rule_version_id, rule_version,
    protocol_version, recommendation_rule_version, product_catalogue_version,
    approved_by, approved_at, captured_by
  ) VALUES (
    NEW.id, v_assessment.id, v_assessment.client_id, v_org.id, v_org.name,
    NEW.category, NEW.kit_product_id, NEW.kit_name, NEW.base_product_id, NEW.base_product_name,
    NEW.active_product_id, NEW.active_name, NEW.dose_ml,
    NEW.companion_product_id, NEW.companion_name, NEW.companion_dose_ml,
    COALESCE(NEW.formula_lines, '[]'::jsonb), NEW.rule_id, NEW.rule_version_id, NEW.rule_version,
    NEW.protocol_version, NEW.recommendation_rule_version, NEW.product_catalogue_version,
    NEW.approved_by, COALESCE(NEW.approved_at, now()), auth.uid()
  )
  ON CONFLICT (formula_snapshot_id) DO NOTHING;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.xcape_capture_customization_usage() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.xcape_capture_customization_usage() FROM anon;
REVOKE ALL ON FUNCTION public.xcape_capture_customization_usage() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.xcape_capture_customization_usage() TO service_role;

DROP TRIGGER IF EXISTS xcape_formula_snapshots_capture_usage ON public.xcape_formula_snapshots;
CREATE TRIGGER xcape_formula_snapshots_capture_usage
AFTER INSERT OR UPDATE OF status ON public.xcape_formula_snapshots
FOR EACH ROW EXECUTE FUNCTION public.xcape_capture_customization_usage();

INSERT INTO public.xcape_customization_usage_events (
  formula_snapshot_id, assessment_id, client_id, cdp_org_id, cdp_org_name,
  category, kit_product_id, kit_name, base_product_id, base_product_name,
  active_product_id, active_name, dose_ml,
  companion_product_id, companion_name, companion_dose_ml,
  formula_lines, rule_id, rule_version_id, rule_version,
  protocol_version, recommendation_rule_version, product_catalogue_version,
  approved_by, approved_at, captured_by
)
SELECT s.id, a.id, a.client_id, o.id, o.name,
  s.category, s.kit_product_id, s.kit_name, s.base_product_id, s.base_product_name,
  s.active_product_id, s.active_name, s.dose_ml,
  s.companion_product_id, s.companion_name, s.companion_dose_ml,
  COALESCE(s.formula_lines, '[]'::jsonb), s.rule_id, s.rule_version_id, s.rule_version,
  s.protocol_version, s.recommendation_rule_version, s.product_catalogue_version,
  s.approved_by, COALESCE(s.approved_at, s.created_at), NULL
FROM public.xcape_formula_snapshots s
JOIN public.client_visit_assessments a ON a.id = s.assessment_id
JOIN public.organizations o ON o.id = a.origin_org_id
WHERE s.status = 'approved'
  AND COALESCE(s.is_demo, false) = false
  AND a.origin_role = 'cdp'
  AND o.kind = 'cdp'
ON CONFLICT (formula_snapshot_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.xcape_admin_customization_usage(
  _org_id uuid DEFAULT NULL,
  _from timestamptz DEFAULT NULL,
  _to timestamptz DEFAULT NULL
)
RETURNS TABLE (
  cdp_org_id uuid,
  cdp_org_name text,
  category text,
  kit_product_id uuid,
  kit_name text,
  active_product_id uuid,
  active_name text,
  companion_product_id uuid,
  companion_name text,
  approved_formula_count bigint,
  total_dose_ml numeric,
  total_companion_dose_ml numeric,
  total_combined_ml numeric,
  first_approved_at timestamptz,
  last_approved_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT e.cdp_org_id,
         max(e.cdp_org_name) AS cdp_org_name,
         e.category,
         e.kit_product_id,
         max(e.kit_name) AS kit_name,
         e.active_product_id,
         max(e.active_name) AS active_name,
         e.companion_product_id,
         max(e.companion_name) AS companion_name,
         count(*)::bigint AS approved_formula_count,
         COALESCE(sum(COALESCE(e.dose_ml, 0)), 0) AS total_dose_ml,
         COALESCE(sum(COALESCE(e.companion_dose_ml, 0)), 0) AS total_companion_dose_ml,
         COALESCE(sum(COALESCE(e.dose_ml, 0) + COALESCE(e.companion_dose_ml, 0)), 0) AS total_combined_ml,
         min(e.approved_at) AS first_approved_at,
         max(e.approved_at) AS last_approved_at
  FROM public.xcape_customization_usage_events e
  WHERE auth.uid() IS NOT NULL
    AND public.is_admin(auth.uid())
    AND (_org_id IS NULL OR e.cdp_org_id = _org_id)
    AND (_from IS NULL OR e.approved_at >= _from)
    AND (_to IS NULL OR e.approved_at < _to)
  GROUP BY e.cdp_org_id, e.category, e.kit_product_id, e.active_product_id, e.companion_product_id
  ORDER BY max(e.cdp_org_name), e.category, max(e.kit_name);
$$;

REVOKE ALL ON FUNCTION public.xcape_admin_customization_usage(uuid, timestamptz, timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.xcape_admin_customization_usage(uuid, timestamptz, timestamptz) FROM anon;
GRANT EXECUTE ON FUNCTION public.xcape_admin_customization_usage(uuid, timestamptz, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.xcape_admin_customization_usage(uuid, timestamptz, timestamptz) TO service_role;