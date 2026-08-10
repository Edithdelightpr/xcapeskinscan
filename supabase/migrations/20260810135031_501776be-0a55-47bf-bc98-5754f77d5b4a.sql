-- ============================================================
-- XCAPE Phase 3: versioned recommendation criteria layer
-- New tables only; no existing structure is altered.
-- ============================================================

-- 1) Protocol Library -------------------------------------------------
CREATE TABLE public.xcape_protocols (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  category text,
  status text NOT NULL DEFAULT 'draft', -- draft | active | archived
  steps jsonb NOT NULL DEFAULT '[]'::jsonb,
  frequency text,
  duration text,
  sessions integer,
  home_care text,
  follow_up_weeks integer,
  linked_service_ids uuid[] NOT NULL DEFAULT '{}',
  linked_product_ids uuid[] NOT NULL DEFAULT '{}',
  is_demo boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.xcape_protocols TO authenticated;
GRANT ALL ON public.xcape_protocols TO service_role;
ALTER TABLE public.xcape_protocols ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage protocols" ON public.xcape_protocols
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Practitioners read active protocols" ON public.xcape_protocols
  FOR SELECT TO authenticated
  USING (status = 'active');

-- 2) Recommendation rules (editable draft + status) --------------------
CREATE TABLE public.xcape_recommendation_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'draft', -- draft | published | inactive | archived
  priority integer NOT NULL DEFAULT 100,
  current_version integer NOT NULL DEFAULT 0,
  draft_conditions jsonb NOT NULL DEFAULT '{"groups":[]}'::jsonb,
  draft_outputs jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_demo boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.xcape_recommendation_rules TO authenticated;
GRANT ALL ON public.xcape_recommendation_rules TO service_role;
ALTER TABLE public.xcape_recommendation_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage rules" ON public.xcape_recommendation_rules
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Practitioners read published rules" ON public.xcape_recommendation_rules
  FOR SELECT TO authenticated
  USING (status = 'published');

-- 3) Immutable published rule versions ---------------------------------
CREATE TABLE public.xcape_rule_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id uuid NOT NULL REFERENCES public.xcape_recommendation_rules(id) ON DELETE CASCADE,
  version integer NOT NULL,
  status text NOT NULL DEFAULT 'published', -- published | inactive | archived
  conditions jsonb NOT NULL,
  outputs jsonb NOT NULL,
  change_note text,
  published_by uuid,
  published_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (rule_id, version)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.xcape_rule_versions TO authenticated;
GRANT ALL ON public.xcape_rule_versions TO service_role;
ALTER TABLE public.xcape_rule_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage rule versions" ON public.xcape_rule_versions
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Practitioners read published versions" ON public.xcape_rule_versions
  FOR SELECT TO authenticated
  USING (status = 'published');

-- 4) Contraindications --------------------------------------------------
CREATE TABLE public.xcape_contraindications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  target_kind text NOT NULL DEFAULT 'protocol', -- protocol | product | ingredient | service
  target_name text,
  target_id uuid,
  severity text NOT NULL DEFAULT 'warning', -- caution | warning | block
  message text NOT NULL,
  status text NOT NULL DEFAULT 'draft', -- draft | active | archived
  is_demo boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.xcape_contraindications TO authenticated;
GRANT ALL ON public.xcape_contraindications TO service_role;
ALTER TABLE public.xcape_contraindications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage contraindications" ON public.xcape_contraindications
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Practitioners read active contraindications" ON public.xcape_contraindications
  FOR SELECT TO authenticated
  USING (status = 'active');

-- 5) Recommendation proposals (practitioner decision audit) ------------
CREATE TABLE public.xcape_recommendation_proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id uuid NOT NULL REFERENCES public.client_visit_assessments(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  rule_id uuid REFERENCES public.xcape_recommendation_rules(id) ON DELETE SET NULL,
  rule_version_id uuid REFERENCES public.xcape_rule_versions(id) ON DELETE SET NULL,
  rule_version integer,
  rule_name text,
  engine_version text,
  matched_reasons jsonb NOT NULL DEFAULT '[]'::jsonb,
  proposal jsonb NOT NULL,
  status text NOT NULL DEFAULT 'proposed', -- proposed | accepted | edited | rejected
  final_result jsonb,
  decision_reason text,
  decided_by uuid,
  decided_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.xcape_recommendation_proposals TO authenticated;
GRANT ALL ON public.xcape_recommendation_proposals TO service_role;
ALTER TABLE public.xcape_recommendation_proposals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Practitioners create proposals" ON public.xcape_recommendation_proposals
  FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());
CREATE POLICY "Practitioners read own proposals, admins read all" ON public.xcape_recommendation_proposals
  FOR SELECT TO authenticated
  USING (created_by = auth.uid() OR decided_by = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "Practitioners decide own proposals" ON public.xcape_recommendation_proposals
  FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR public.is_admin(auth.uid()))
  WITH CHECK (created_by = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "Admins delete proposals" ON public.xcape_recommendation_proposals
  FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()));

-- 6) Rule audit history -------------------------------------------------
CREATE TABLE public.xcape_rule_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id uuid NOT NULL REFERENCES public.xcape_recommendation_rules(id) ON DELETE CASCADE,
  action text NOT NULL, -- created | updated | published | deactivated | reactivated | archived | version_retired
  actor uuid,
  snapshot jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.xcape_rule_audit TO authenticated;
GRANT ALL ON public.xcape_rule_audit TO service_role;
ALTER TABLE public.xcape_rule_audit ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read rule audit" ON public.xcape_rule_audit
  FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

-- updated_at maintenance -----------------------------------------------
CREATE OR REPLACE FUNCTION public.xcape_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.xcape_touch_updated_at() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER xcape_protocols_touch BEFORE UPDATE ON public.xcape_protocols
  FOR EACH ROW EXECUTE FUNCTION public.xcape_touch_updated_at();
CREATE TRIGGER xcape_rules_touch BEFORE UPDATE ON public.xcape_recommendation_rules
  FOR EACH ROW EXECUTE FUNCTION public.xcape_touch_updated_at();
CREATE TRIGGER xcape_contraindications_touch BEFORE UPDATE ON public.xcape_contraindications
  FOR EACH ROW EXECUTE FUNCTION public.xcape_touch_updated_at();
CREATE TRIGGER xcape_proposals_touch BEFORE UPDATE ON public.xcape_recommendation_proposals
  FOR EACH ROW EXECUTE FUNCTION public.xcape_touch_updated_at();

-- Rule audit trigger: logs create/update/publish lifecycle --------------
CREATE OR REPLACE FUNCTION public.xcape_log_rule_audit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _action text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    _action := 'created';
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
    _action := CASE NEW.status
      WHEN 'published' THEN 'published'
      WHEN 'inactive' THEN 'deactivated'
      WHEN 'archived' THEN 'archived'
      ELSE 'updated' END;
  ELSIF NEW.current_version IS DISTINCT FROM OLD.current_version THEN
    _action := 'published';
  ELSE
    _action := 'updated';
  END IF;
  INSERT INTO public.xcape_rule_audit (rule_id, action, actor, snapshot)
  VALUES (NEW.id, _action, auth.uid(), to_jsonb(NEW));
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.xcape_log_rule_audit() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER xcape_rules_audit_ins AFTER INSERT ON public.xcape_recommendation_rules
  FOR EACH ROW EXECUTE FUNCTION public.xcape_log_rule_audit();
CREATE TRIGGER xcape_rules_audit_upd AFTER UPDATE ON public.xcape_recommendation_rules
  FOR EACH ROW EXECUTE FUNCTION public.xcape_log_rule_audit();

-- Demo placeholder rule (draft, is_demo=true — never executes) ----------
INSERT INTO public.xcape_recommendation_rules (
  name, description, status, priority, is_demo, draft_conditions, draft_outputs
) VALUES (
  'DEMO — placeholder rule (not clinical)',
  'Non-clinical demonstration record for UI testing only. It is kept in draft status and excluded from evaluation and report generation. Replace with the official XCAPE clinical criteria when supplied.',
  'draft',
  999,
  true,
  '{"groups":[{"combinator":"all","conditions":[{"field":"score.pigmentation_stability","operator":"lte","value":"40"}]}]}'::jsonb,
  '{"rationale":"Demo placeholder only — not a clinical recommendation.","requires_human_review":true}'::jsonb
);