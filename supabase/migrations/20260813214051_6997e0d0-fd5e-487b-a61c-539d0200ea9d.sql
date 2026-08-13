INSERT INTO public.xcape_recommendation_configs (version, status, notes, published_at)
VALUES (2, 'published', 'XCAPE v2 — derived body protocol: Advanced Serum and Body Milk activate at raw health < 75 (severity >= 26); Body Milk weak-elasticity line = 5x the Face Cream anti-aging line; unrelated Body Milk activations removed.', now())
ON CONFLICT (version) DO NOTHING;

INSERT INTO public.xcape_severity_bands (config_id, code, label, severity_min, severity_max, sort_order)
SELECT c2.id, b.code, b.label, b.severity_min, b.severity_max, b.sort_order
FROM public.xcape_recommendation_configs c2
JOIN public.xcape_recommendation_configs c1 ON c1.version = 1
JOIN public.xcape_severity_bands b ON b.config_id = c1.id
WHERE c2.version = 2;

INSERT INTO public.xcape_activation_rules
  (config_id, category, product_sku, area, min_severity, priority_weight, satisfies_need, foundation)
SELECT c.id, v.category, v.sku, v.area, v.min_sev, v.weight, v.satisfies, v.foundation
FROM public.xcape_recommendation_configs c,
  (VALUES
    ('oil_congestion_balance', 'XC-PURIFYING-CLEANSER', 'face', 0, 1.0, true, true),
    ('oil_congestion_balance', 'XC-AF-TONER', 'face', 0, 1.0, true, true),
    ('oil_congestion_balance', 'XC-FACE-CREAM', 'face', 0, 1.0, true, true),
    ('barrier_surface_hydration', 'XC-AF-TONER', 'face', 0, 1.0, false, true),
    ('barrier_surface_hydration', 'XC-FACE-CREAM', 'face', 0, 1.1, true, true),
    ('barrier_surface_hydration', 'XC-TREATMENT-GLYCERINE', 'body', 60, 1.0, false, false),
    ('firmness_skin_support', 'XC-FACE-CREAM', 'face', 0, 1.0, true, true),
    ('firmness_skin_support', 'XC-BODY-MILK', 'body', 26, 1.0, true, false),
    ('pigmentation_stability', 'XC-FACE-CREAM', 'face', 0, 1.0, false, true),
    ('pigmentation_stability', 'XC-ADVANCED-SERUM', 'face', 50, 1.2, true, false),
    ('pigmentation_stability', 'XC-ADVANCED-SERUM', 'body', 26, 1.0, false, false),
    ('pigmentation_stability', 'XC-TREATMENT-GLYCERINE', 'body', 70, 1.0, false, false)
  ) AS v(category, sku, area, min_sev, weight, satisfies, foundation)
WHERE c.version = 2;

INSERT INTO public.xcape_interaction_rules
  (config_id, code, when_category, when_min_severity, and_category, and_min_severity, and_max_severity,
   boost_category, priority_boost, client_text, practitioner_text, sort_order)
SELECT c2.id, i.code, i.when_category, i.when_min_severity, i.and_category, i.and_min_severity,
       i.and_max_severity, i.boost_category, i.priority_boost, i.client_text, i.practitioner_text, i.sort_order
FROM public.xcape_recommendation_configs c2
JOIN public.xcape_recommendation_configs c1 ON c1.version = 1
JOIN public.xcape_interaction_rules i ON i.config_id = c1.id
WHERE c2.version = 2;

INSERT INTO public.xcape_compatibility_rules (config_id, product_sku_a, product_sku_b, status, note)
SELECT c2.id, r.product_sku_a, r.product_sku_b, r.status, r.note
FROM public.xcape_recommendation_configs c2
JOIN public.xcape_recommendation_configs c1 ON c1.version = 1
JOIN public.xcape_compatibility_rules r ON r.config_id = c1.id
WHERE c2.version = 2;

UPDATE public.xcape_recommendation_configs SET status = 'retired' WHERE version = 1;

UPDATE public.xcape_product_alignments SET dose_multiplier = 1 WHERE dose_multiplier <> 1;

DELETE FROM public.xcape_product_alignments a
USING public.products p
WHERE a.product_id = p.id
  AND p.sku = 'XC-BODY-MILK'
  AND a.area = 'body'
  AND a.category <> 'firmness_skin_support';