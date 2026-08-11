-- ── 1. Team role data access ─────────────────────────────────────────
DROP POLICY IF EXISTS "Staff with intake can insert clients" ON public.clients;
CREATE POLICY "Staff with intake can insert clients" ON public.clients
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'front_desk')
    OR public.has_role(auth.uid(), 'medical_aesthetician') OR public.has_role(auth.uid(), 'outreach')
    OR public.has_role(auth.uid(), 'team')
  );

CREATE POLICY "Team view attributed clients" ON public.clients
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'team') AND attributed_staff_id = auth.uid());

DROP POLICY IF EXISTS "Clinical staff can view assessments" ON public.client_visit_assessments;
CREATE POLICY "Clinical staff can view assessments" ON public.client_visit_assessments
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'front_desk')
    OR public.has_role(auth.uid(), 'medical_aesthetician') OR public.has_role(auth.uid(), 'outreach')
    OR public.has_role(auth.uid(), 'team')
  );

CREATE POLICY "Team insert attributed client media" ON public.client_media
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'team')
    AND EXISTS (SELECT 1 FROM public.clients c WHERE c.id = client_media.client_id AND c.attributed_staff_id = auth.uid())
  );

CREATE POLICY "Team view attributed client media" ON public.client_media
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'team')
    AND EXISTS (SELECT 1 FROM public.clients c WHERE c.id = client_media.client_id AND c.attributed_staff_id = auth.uid())
  );

-- ── 2. Event invitations (client RSVP model) ─────────────────────────
CREATE TABLE public.event_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.calendar_events(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  token_hash text NOT NULL,
  token_prefix text NOT NULL,
  response_status text NOT NULL DEFAULT 'pending',
  responded_at timestamptz,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT event_invitations_response_status_check CHECK (response_status IN ('pending', 'accepted', 'declined')),
  CONSTRAINT event_invitations_event_client_key UNIQUE (event_id, client_id),
  CONSTRAINT event_invitations_token_hash_key UNIQUE (token_hash)
);
CREATE INDEX idx_event_invitations_event ON public.event_invitations(event_id);
CREATE INDEX idx_event_invitations_client ON public.event_invitations(client_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_invitations TO authenticated;
GRANT ALL ON public.event_invitations TO service_role;

ALTER TABLE public.event_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Managers view invitations" ON public.event_invitations
  FOR SELECT TO authenticated
  USING (public.has_section_access(auth.uid(), 'admin-calendar') OR created_by = auth.uid());

CREATE POLICY "Managers create invitations" ON public.event_invitations
  FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Managers update invitations" ON public.event_invitations
  FOR UPDATE TO authenticated
  USING (public.has_section_access(auth.uid(), 'admin-calendar') OR created_by = auth.uid())
  WITH CHECK (public.has_section_access(auth.uid(), 'admin-calendar') OR created_by = auth.uid());

CREATE POLICY "Admins delete invitations" ON public.event_invitations
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- ── 3. JobRole seeds ─────────────────────────────────────────────────
INSERT INTO public.job_roles (title, description, department, legacy_role, permissions)
SELECT 'Team',
  'XCAPE field team — lead capture, attribution and client event invitations',
  'Field',
  'outreach',
  '{"sections":["admin-dashboard","staff-today","staff-eod","admin-leads","admin-attribution","admin-calendar","xcape-analysis","xcape-clients","xcape-reports","xcape-events","xcape-account"],"canManageLeads":true,"canViewClients":true,"canLogFinance":false,"canManageBookings":false}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM public.job_roles WHERE title = 'Team');

UPDATE public.job_roles
SET permissions = jsonb_set(
  permissions,
  '{sections}',
  (permissions->'sections') || '["xcape-analysis","xcape-clients","xcape-reports","xcape-history","xcape-protocols","xcape-account"]'::jsonb
)
WHERE active = true AND title <> 'Team';

-- ── 4. Harden capture_outreach_lead ──────────────────────────────────
CREATE OR REPLACE FUNCTION public.capture_outreach_lead(
  _outreach_id uuid,
  _full_name text,
  _phone text,
  _email text DEFAULT NULL::text,
  _gender text DEFAULT NULL::text,
  _notes text DEFAULT NULL::text,
  _wants_consult boolean DEFAULT false,
  _marketing_consent boolean DEFAULT false,
  _staff_id uuid DEFAULT NULL::uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_now timestamptz := now();
  v_today_local date := (now() AT TIME ZONE 'Africa/Lagos')::date;
  v_normalized_phone text := regexp_replace(COALESCE(_phone, ''), '\D', '', 'g');
  v_email text := nullif(btrim(COALESCE(_email, '')), '');
  v_full_name text := nullif(btrim(COALESCE(_full_name, '')), '');
  v_gender text := CASE WHEN COALESCE(_gender, '') IN ('male','female') THEN _gender ELSE NULL END;
  v_outreach record;
  v_attrib uuid := _staff_id;
  v_today date := current_date;
  v_existing_id uuid;
  v_new_client_id uuid;
  v_client_id uuid;
  v_created boolean;
  v_marketing_consent boolean := COALESCE(_marketing_consent, false);
  v_consent_status text := CASE WHEN COALESCE(_marketing_consent, false) THEN 'given' ELSE 'unknown' END;
  v_audit_notes text := concat_ws(E'\n',
    NULLIF(_notes, ''),
    CASE WHEN _wants_consult THEN 'Consultation requested via outreach intake.' ELSE NULL END
  );
  v_visit_id uuid;
  v_visit_created boolean := false;
  v_visit_error text;
BEGIN
  -- Reject caller-supplied staff attribution that is not an active staff member.
  IF v_attrib IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.staff_users su WHERE su.id = v_attrib AND su.status = 'active'
  ) THEN
    v_attrib := NULL;
  END IF;

  SELECT * INTO v_outreach FROM public.outreach_sessions WHERE id = _outreach_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Outreach session % not found', _outreach_id;
  END IF;

  IF v_full_name IS NULL THEN
    RAISE EXCEPTION 'Full name is required';
  END IF;
  IF v_normalized_phone = '' THEN
    RAISE EXCEPTION 'Phone number is required';
  END IF;

  IF v_attrib IS NULL THEN
    v_attrib := v_outreach.initiator_user_id;
  END IF;
  IF v_attrib IS NULL THEN
    v_attrib := v_outreach.created_by;
  END IF;
  IF v_attrib IS NULL THEN
    SELECT ur.user_id INTO v_attrib
    FROM public.user_roles ur
    JOIN public.staff_users su ON su.id = ur.user_id AND su.status = 'active'
    WHERE ur.role = 'admin'
    ORDER BY ur.created_at NULLS LAST
    LIMIT 1;
  END IF;

  IF v_attrib IS NULL THEN
    RAISE EXCEPTION 'No staff member could be resolved for lead attribution';
  END IF;

  SELECT id INTO v_existing_id
  FROM public.clients
  WHERE (v_normalized_phone <> '' AND regexp_replace(COALESCE(phone, ''), '\D', '', 'g') = v_normalized_phone)
     OR (v_email IS NOT NULL AND lower(email) = lower(v_email))
  LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    UPDATE public.clients
       SET email = COALESCE(email, v_email),
           marketing_consent = v_marketing_consent,
           consent_status = v_consent_status,
           consent_captured_at = v_now,
           consent_given_at = CASE WHEN v_marketing_consent THEN v_now ELSE consent_given_at END
     WHERE id = v_existing_id;

    INSERT INTO public.lead_interactions
      (client_id, staff_user_id, method, outcome, outreach_id, notes)
    VALUES
      (v_existing_id, v_attrib, 'outreach',
       CASE WHEN _wants_consult THEN 'interested' ELSE 'reached' END,
       _outreach_id, v_audit_notes);

    v_client_id := v_existing_id;
    v_created := false;
  ELSE
    INSERT INTO public.clients (
      full_name, phone, email, gender,
      outreach_id, captured_via, intake_source, source_type,
      attributed_staff_id, acquisition_owner_id, original_source,
      acquisition_locked, first_seen_at, status, notes,
      marketing_consent, consent_status, consent_captured_at,
      consent_given_at
    ) VALUES (
      v_full_name, v_normalized_phone, v_email, v_gender,
      _outreach_id, 'outreach', 'outreach', 'outreach',
      v_attrib, v_attrib, 'outreach',
      true, v_now, 'lead'::public.client_status, v_audit_notes,
      v_marketing_consent, v_consent_status, v_now,
      CASE WHEN v_marketing_consent THEN v_now ELSE NULL END
    )
    RETURNING id INTO v_new_client_id;

    INSERT INTO public.lead_interactions
      (client_id, staff_user_id, method, outcome, outreach_id, notes)
    VALUES
      (v_new_client_id, v_attrib, 'outreach',
       CASE WHEN _wants_consult THEN 'interested' ELSE 'reached' END,
       _outreach_id, v_audit_notes);

    v_client_id := v_new_client_id;
    v_created := true;
  END IF;

  BEGIN
    SELECT id INTO v_visit_id
    FROM public.client_visit_logs
    WHERE client_id = v_client_id
      AND source_type = 'outreach'
      AND source_id = _outreach_id
      AND sign_out_time IS NULL
      AND visit_date = v_today_local
    ORDER BY sign_in_time DESC
    LIMIT 1;

    IF v_visit_id IS NULL THEN
      INSERT INTO public.client_visit_logs (
        client_id, logged_by_staff_id, reason_for_visit,
        visit_type, source_type, source_id,
        attributed_to_user_id, assigned_medical_expert_id,
        visit_date
      ) VALUES (
        v_client_id, v_attrib, 'consultation',
        'outreach_conversion', 'outreach', _outreach_id,
        v_attrib, NULL,
        v_today_local
      )
      RETURNING id INTO v_visit_id;
      v_visit_created := true;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_visit_error := SQLERRM;
    v_visit_created := false;
  END;

  RETURN jsonb_build_object(
    'client_id', v_client_id,
    'created', v_created,
    'outreach_id', _outreach_id,
    'attributed_staff_id', v_attrib,
    'visit_id', v_visit_id,
    'visit_created', v_visit_created,
    'visit_error', v_visit_error
  );
END;
$function$;