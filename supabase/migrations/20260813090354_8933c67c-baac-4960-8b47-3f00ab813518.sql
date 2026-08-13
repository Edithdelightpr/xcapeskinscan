-- 1. Real XCAPE catalogue products (idempotent by SKU, no invented prices)
INSERT INTO public.products (name, sku, category, selling_price, active, public_visible, short_description, usage_instructions)
SELECT v.name, v.sku, v.category, 0, true, false, v.short_description, v.usage_instructions
FROM (VALUES
  ('XCAPE Face Cream', 'XC-FACE-CREAM', 'Skincare', 'Customizable XCAPE facial moisturizer — the carrier for facial DS active solutions.', 'Apply to the face as directed by your practitioner.'),
  ('XCAPE Advanced Serum', 'XC-ADVANCED-SERUM', 'Skincare', 'Customizable XCAPE advanced serum, used on face and body lines.', 'Apply to the treated area as directed by your practitioner.'),
  ('XCAPE Purifying Cleanser', 'XC-PURIFYING-CLEANSER', 'Skincare', 'Customizable XCAPE purifying cleanser for oversebaceous facial skin.', 'Cleanse as directed by your practitioner.'),
  ('XCAPE Alcohol-Free Toner', 'XC-AF-TONER', 'Skincare', 'Customizable XCAPE alcohol-free toner.', 'Apply to the face after cleansing as directed by your practitioner.'),
  ('XCAPE Body Milk', 'XC-BODY-MILK', 'Skincare', 'Customizable XCAPE body milk — the primary body carrier.', 'Apply to the body as directed by your practitioner.'),
  ('XCAPE Treatment Glycerine', 'XC-TREATMENT-GLYCERINE', 'Skincare', 'Customizable XCAPE treatment glycerine for body lines.', 'Apply to the body as directed by your practitioner.')
) AS v(name, sku, category, short_description, usage_instructions)
WHERE NOT EXISTS (SELECT 1 FROM public.products p WHERE lower(p.sku) = lower(v.sku));

-- 2. Internal DS active solutions — never public, never separately purchasable
INSERT INTO public.products (name, sku, category, selling_price, active, public_visible, short_description)
SELECT v.name, v.sku, 'ds_active', 0, true, false, v.short_description
FROM (VALUES
  ('DS Tyrosinase Inhibitor', 'XC-DS-TYROSINASE', 'Internal DS active solution for hyperpigmentation lines.'),
  ('DS P Bacterium', 'XC-DS-PBACTERIUM', 'Internal DS active solution for oversebaceous activity lines.'),
  ('DS Anti-Aging', 'XC-DS-ANTIAGING', 'Internal DS active solution for weak elasticity lines.'),
  ('DS Sebum Control', 'XC-DS-SEBUM', 'Internal DS active solution for surface dehydration lines.'),
  ('DS Anti-Inflammatory', 'XC-DS-ANTIINFLAM', 'Internal DS companion solution — never standalone.')
) AS v(name, sku, short_description)
WHERE NOT EXISTS (SELECT 1 FROM public.products p WHERE lower(p.sku) = lower(v.sku));

-- 3. Normalized many-product alignment map
CREATE TABLE IF NOT EXISTS public.xcape_product_alignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  area text NOT NULL CHECK (area IN ('face','body')),
  dose_multiplier numeric NOT NULL DEFAULT 1 CHECK (dose_multiplier > 0),
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT xcape_product_alignments_category_chk CHECK (category IN (
    'pigmentation_stability','oil_congestion_balance','firmness_skin_support','barrier_surface_hydration'
  )),
  CONSTRAINT xcape_product_alignments_unique UNIQUE (category, product_id, area)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.xcape_product_alignments TO authenticated;
GRANT ALL ON public.xcape_product_alignments TO service_role;

ALTER TABLE public.xcape_product_alignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can view product alignments" ON public.xcape_product_alignments;
CREATE POLICY "Staff can view product alignments"
ON public.xcape_product_alignments FOR SELECT TO authenticated
USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Admins manage product alignments" ON public.xcape_product_alignments;
CREATE POLICY "Admins manage product alignments"
ON public.xcape_product_alignments FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP TRIGGER IF EXISTS trg_xcape_product_alignments_updated ON public.xcape_product_alignments;
CREATE TRIGGER trg_xcape_product_alignments_updated
BEFORE UPDATE ON public.xcape_product_alignments
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Seed the confirmed alignment (idempotent)
INSERT INTO public.xcape_product_alignments (category, product_id, area, dose_multiplier, is_active, sort_order)
SELECT v.category, p.id, v.area, CASE WHEN v.area = 'body' THEN 3 ELSE 1 END, true, v.sort_order
FROM (VALUES
  ('pigmentation_stability','XC-FACE-CREAM','face',0),
  ('pigmentation_stability','XC-ADVANCED-SERUM','face',1),
  ('pigmentation_stability','XC-BODY-MILK','body',0),
  ('pigmentation_stability','XC-ADVANCED-SERUM','body',1),
  ('pigmentation_stability','XC-TREATMENT-GLYCERINE','body',2),
  ('oil_congestion_balance','XC-PURIFYING-CLEANSER','face',0),
  ('oil_congestion_balance','XC-AF-TONER','face',1),
  ('oil_congestion_balance','XC-FACE-CREAM','face',2),
  ('oil_congestion_balance','XC-BODY-MILK','body',0),
  ('firmness_skin_support','XC-FACE-CREAM','face',0),
  ('firmness_skin_support','XC-BODY-MILK','body',0),
  ('barrier_surface_hydration','XC-AF-TONER','face',0),
  ('barrier_surface_hydration','XC-FACE-CREAM','face',1),
  ('barrier_surface_hydration','XC-BODY-MILK','body',0),
  ('barrier_surface_hydration','XC-TREATMENT-GLYCERINE','body',1)
) AS v(category, sku, area, sort_order)
JOIN public.products p ON lower(p.sku) = lower(v.sku)
ON CONFLICT (category, product_id, area) DO NOTHING;

-- 5. Immutable multi-line formula snapshot support
ALTER TABLE public.xcape_formula_snapshots
  ADD COLUMN IF NOT EXISTS formula_lines jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS protocol_version text;