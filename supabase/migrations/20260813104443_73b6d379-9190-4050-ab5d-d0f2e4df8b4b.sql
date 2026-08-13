UPDATE public.products SET image_url = v.url, updated_at = now()
FROM (VALUES
  ('XC-FACE-CREAM', '/__l5e/assets-v1/3cde619b-7f91-4ee5-adea-8b79f9015f8d/xcape-face-cream.jpg'),
  ('XC-ADVANCED-SERUM', '/__l5e/assets-v1/228cc74e-72f8-4c31-a8ab-adbbf8a42732/xcape-advanced-serum.jpg'),
  ('XC-AF-TONER', '/__l5e/assets-v1/706172e0-a131-47ff-8829-c7dfd69abdd9/xcape-alcohol-free-toner.jpg'),
  ('XC-PURIFYING-CLEANSER', '/__l5e/assets-v1/8400b54d-0bd1-44a6-9520-41cf1cf2b43b/xcape-purifying-cleanser.jpg'),
  ('XC-TREATMENT-GLYCERINE', '/__l5e/assets-v1/f1d246af-2c97-4f3c-9922-cd5fccce01a9/xcape-treatment-glycerine.jpg'),
  ('XC-BODY-MILK', '/__l5e/assets-v1/d1d65953-eb1e-440a-ac59-ac485aebccc0/xcape-body-milk.jpg')
) AS v(sku, url)
WHERE public.products.sku = v.sku
  AND (public.products.image_url IS NULL OR public.products.image_url = '');