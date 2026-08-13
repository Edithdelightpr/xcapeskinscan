REVOKE ALL ON public.xcape_product_alignments FROM anon;
GRANT SELECT ON public.xcape_product_alignments TO authenticated;
GRANT ALL ON public.xcape_product_alignments TO service_role;