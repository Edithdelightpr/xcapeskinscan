-- ============ Versioned recommendation configuration ============
CREATE TABLE public.xcape_recommendation_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version integer NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'draft',
  notes text,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT xcape_recommendation_configs_status_check
    CHECK (status IN ('draft', 'published', 'retired'))
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.xcape_recommendation_configs TO authenticated;
GRANT ALL ON public.xcape_recommendation_configs TO service_role;
ALTER TABLE public.xcape_recommendation_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can read recommendation configs"
  ON public.xcape_recommendation_configs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage recommendation configs"
  ON public.xcape_recommendation_configs FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============ Severity bands ============
CREATE TABLE public.xcape_severity_bands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id uuid NOT NULL REFERENCES public.xcape_recommendation_configs(id) ON DELETE CASCADE,
  code text NOT NULL,
  label text NOT NULL,
  severity_min integer NOT NULL,
  severity_max integer NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (config_id, code)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.xcape_severity_bands TO authenticated;
GRANT ALL ON public.xcape_severity_bands TO service_role;
ALTER TABLE public.xcape_severity_bands ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can read severity bands"
  ON public.xcape_severity_bands FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage severity bands"
  ON public.xcape_severity_bands FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============ Activation rules ============
CREATE TABLE public.xcape_activation_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id uuid NOT NULL REFERENCES public.xcape_recommendation_configs(id) ON DELETE CASCADE,
  category text NOT NULL,
  product_sku text NOT NULL,
  area text NOT NULL DEFAULT 'face',
  min_severity integer NOT NULL DEFAULT 0,
  priority_weight numeric NOT NULL DEFAULT 1,
  satisfies_need boolean NOT NULL DEFAULT false,
  foundation boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (config_id, category, product_sku, area)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.xcape_activation_rules TO authenticated;
GRANT ALL ON public.xcape_activation_rules TO service_role;
ALTER TABLE public.xcape_activation_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can read activation rules"
  ON public.xcape_activation_rules FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage activation rules"
  ON public.xcape_activation_rules FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============ Interaction rules ============
CREATE TABLE public.xcape_interaction_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id uuid NOT NULL REFERENCES public.xcape_recommendation_configs(id) ON DELETE CASCADE,
  code text NOT NULL,
  when_category text NOT NULL,
  when_min_severity integer NOT NULL DEFAULT 0,
  and_category text,
  and_min_severity integer NOT NULL DEFAULT 0,
  and_max_severity integer NOT NULL DEFAULT 100,
  boost_category text,
  priority_boost numeric NOT NULL DEFAULT 0,
  client_text text NOT NULL,
  practitioner_text text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (config_id, code)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.xcape_interaction_rules TO authenticated;
GRANT ALL ON public.xcape_interaction_rules TO service_role;
ALTER TABLE public.xcape_interaction_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can read interaction rules"
  ON public.xcape_interaction_rules FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage interaction rules"
  ON public.xcape_interaction_rules FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============ Compatibility rules ============
CREATE TABLE public.xcape_compatibility_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id uuid NOT NULL REFERENCES public.xcape_recommendation_configs(id) ON DELETE CASCADE,
  product_sku_a text NOT NULL,
  product_sku_b text NOT NULL,
  status text NOT NULL DEFAULT 'allow',
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (config_id, product_sku_a, product_sku_b),
  CONSTRAINT xcape_compatibility_rules_status_check
    CHECK (status IN ('allow', 'prefer', 'optional', 'avoid', 'requires_review'))
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.xcape_compatibility_rules TO authenticated;
GRANT ALL ON public.xcape_compatibility_rules TO service_role;
ALTER TABLE public.xcape_compatibility_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can read compatibility rules"
  ON public.xcape_compatibility_rules FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage compatibility rules"
  ON public.xcape_compatibility_rules FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============ updated_at triggers ============
CREATE TRIGGER trg_xcape_recommendation_configs_updated_at
  BEFORE UPDATE ON public.xcape_recommendation_configs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_xcape_severity_bands_updated_at
  BEFORE UPDATE ON public.xcape_severity_bands
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_xcape_activation_rules_updated_at
  BEFORE UPDATE ON public.xcape_activation_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_xcape_interaction_rules_updated_at
  BEFORE UPDATE ON public.xcape_interaction_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_xcape_compatibility_rules_updated_at
  BEFORE UPDATE ON public.xcape_compatibility_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ Snapshot audit columns ============
ALTER TABLE public.xcape_formula_snapshots
  ADD COLUMN IF NOT EXISTS recommendation_rule_version integer,
  ADD COLUMN IF NOT EXISTS product_catalogue_version text,
  ADD COLUMN IF NOT EXISTS decisions jsonb NOT NULL DEFAULT '[]'::jsonb;

-- ============ Seed config version 1 ============
INSERT INTO public.xcape_recommendation_configs (version, status, notes, published_at)
VALUES (1, 'published', 'XCAPE intelligent recommendation engine — initial confirmed configuration.', now());

INSERT INTO public.xcape_severity_bands (config_id, code, label, severity_min, severity_max, sort_order)
SELECT c.id, v.code, v.label, v.smin, v.smax, v.ord
FROM public.xcape_recommendation_configs c,
  (VALUES
    ('maintenance', 'Maintenance', 0, 24, 0),
    ('supportive', 'Supportive', 25, 49, 1),
    ('intervention', 'Intervention', 50, 74, 2),
    ('priority', 'Priority intervention', 75, 100, 3)
  ) AS v(code, label, smin, smax, ord)
WHERE c.version = 1;

INSERT INTO public.xcape_activation_rules
  (config_id, category, product_sku, area, min_severity, priority_weight, satisfies_need, foundation)
SELECT c.id, v.category, v.sku, v.area, v.min_sev, v.weight, v.satisfies, v.foundation
FROM public.xcape_recommendation_configs c,
  (VALUES
    -- Foundation facial system: always appropriate.
    ('oil_congestion_balance', 'XC-PURIFYING-CLEANSER', 'face', 0, 1.0, true, true),
    ('oil_congestion_balance', 'XC-AF-TONER', 'face', 0, 1.0, true, true),
    ('oil_congestion_balance', 'XC-FACE-CREAM', 'face', 0, 1.0, true, true),
    ('oil_congestion_balance', 'XC-BODY-MILK', 'body', 40, 1.0, true, false),
    ('barrier_surface_hydration', 'XC-AF-TONER', 'face', 0, 1.0, false, true),
    ('barrier_surface_hydration', 'XC-FACE-CREAM', 'face', 0, 1.1, true, true),
    ('barrier_surface_hydration', 'XC-TREATMENT-GLYCERINE', 'body', 60, 1.0, false, false),
    ('barrier_surface_hydration', 'XC-BODY-MILK', 'body', 40, 1.0, true, false),
    ('firmness_skin_support', 'XC-FACE-CREAM', 'face', 0, 1.0, true, true),
    ('firmness_skin_support', 'XC-BODY-MILK', 'body', 40, 1.0, true, false),
    ('pigmentation_stability', 'XC-FACE-CREAM', 'face', 0, 1.0, false, true),
    ('pigmentation_stability', 'XC-ADVANCED-SERUM', 'face', 50, 1.2, true, false),
    ('pigmentation_stability', 'XC-BODY-MILK', 'body', 40, 1.0, false, false),
    ('pigmentation_stability', 'XC-ADVANCED-SERUM', 'body', 60, 1.0, false, false),
    ('pigmentation_stability', 'XC-TREATMENT-GLYCERINE', 'body', 70, 1.0, false, false)
  ) AS v(category, sku, area, min_sev, weight, satisfies, foundation)
WHERE c.version = 1;

INSERT INTO public.xcape_interaction_rules
  (config_id, code, when_category, when_min_severity, and_category, and_min_severity, and_max_severity,
   boost_category, priority_boost, client_text, practitioner_text, sort_order)
SELECT c.id, v.code, v.wcat, v.wmin, v.acat, v.amin, v.amax, v.bcat, v.boost, v.ctext, v.ptext, v.ord
FROM public.xcape_recommendation_configs c,
  (VALUES
    ('oil_with_dehydration', 'oil_congestion_balance', 50, 'barrier_surface_hydration', 40, 100,
     'barrier_surface_hydration', 8,
     'Your skin is producing excess surface oil while still reading as dehydrated, so your protocol controls oil without stripping the surface.',
     'High oil + moderate/high dehydration: control without stripping. Hydration and barrier support are protected; no escalation of cleansing intensity.', 0),
    ('dehydration_with_elasticity', 'barrier_surface_hydration', 50, 'firmness_skin_support', 50, 100,
     'barrier_surface_hydration', 6,
     'Hydration and barrier support are foundational to improving how firm and supported your skin looks.',
     'High dehydration + weak elasticity: hydration/barrier support becomes foundational to the elasticity strategy.', 1),
    ('pigmentation_with_oil', 'pigmentation_stability', 50, 'oil_congestion_balance', 50, 100,
     'oil_congestion_balance', 6,
     'Uneven tone is being addressed alongside the surface conditions that contribute to it, rather than in isolation.',
     'High pigmentation + high oil/congestion: treat the contributing environment together with pigmentation.', 2),
    ('pigmentation_direct', 'pigmentation_stability', 50, 'oil_congestion_balance', 0, 49,
     'pigmentation_stability', 6,
     'Your tone concerns are being addressed directly, since surface oil is not a significant factor for you.',
     'High pigmentation + low oil/congestion: direct pigmentation-management pathway.', 3)
  ) AS v(code, wcat, wmin, acat, amin, amax, bcat, boost, ctext, ptext, ord)
WHERE c.version = 1;

INSERT INTO public.xcape_compatibility_rules (config_id, product_sku_a, product_sku_b, status, note)
SELECT c.id, v.a, v.b, v.status, v.note
FROM public.xcape_recommendation_configs c,
  (VALUES
    ('XC-PURIFYING-CLEANSER', 'XC-AF-TONER', 'prefer', 'Cleanse then rebalance — the confirmed foundation sequence.'),
    ('XC-AF-TONER', 'XC-FACE-CREAM', 'prefer', 'Rebalance then hydrate/repair.'),
    ('XC-ADVANCED-SERUM', 'XC-FACE-CREAM', 'allow', 'Serum sits under the customized cream.'),
    ('XC-ADVANCED-SERUM', 'XC-TREATMENT-GLYCERINE', 'optional', 'Both may be used; body glycerine is independent of the facial serum.'),
    ('XC-TREATMENT-GLYCERINE', 'XC-BODY-MILK', 'prefer', 'Glycerine before the customized body milk.')
  ) AS v(a, b, status, note)
WHERE c.version = 1;