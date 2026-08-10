-- Admin-only mockup/template storage for XCAPE report-card design previews.
-- Mock values are configuration only: they never become products, formula
-- snapshots, proposals, or order rows, and are never publicly readable.

CREATE TABLE public.xcape_admin_mockups (
  key text PRIMARY KEY,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.xcape_admin_mockups TO authenticated;
GRANT ALL ON public.xcape_admin_mockups TO service_role;

ALTER TABLE public.xcape_admin_mockups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read mockups"
  ON public.xcape_admin_mockups
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert mockups"
  ON public.xcape_admin_mockups
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update mockups"
  ON public.xcape_admin_mockups
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- No DELETE policy: mockups are updated in place, never removed via the API.

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_xcape_admin_mockups_updated_at
  BEFORE UPDATE ON public.xcape_admin_mockups
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();