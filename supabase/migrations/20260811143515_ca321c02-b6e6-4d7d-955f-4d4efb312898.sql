-- ── 1. Approval audit on staff assignments ───────────────────────────
ALTER TABLE public.staff_assignments
  ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES public.staff_users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz;

-- ── 2. Self-service Team join intent (pending, grants nothing) ───────
CREATE OR REPLACE FUNCTION public.claim_team_intent()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  team_role_id uuid;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  -- Never touch accounts that already hold any app role (incl. admins).
  IF EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = uid) THEN
    RETURN jsonb_build_object('claimed', false, 'reason', 'role_already_assigned');
  END IF;

  SELECT id INTO team_role_id
  FROM public.job_roles
  WHERE title = 'Team' AND active
  LIMIT 1;

  IF team_role_id IS NULL THEN
    RAISE EXCEPTION 'team job role not configured';
  END IF;

  -- Idempotent: only fills an empty assignment, never overwrites an
  -- administrator's existing job-role decision.
  INSERT INTO public.staff_assignments (staff_user_id, job_role_id)
  VALUES (uid, team_role_id)
  ON CONFLICT (staff_user_id) DO UPDATE
    SET job_role_id = EXCLUDED.job_role_id,
        updated_at = now()
    WHERE public.staff_assignments.job_role_id IS NULL;

  -- Pending state only. Access still requires admin approval.
  UPDATE public.staff_users
  SET status = 'invited', updated_at = now()
  WHERE id = uid AND status = 'inactive';

  RETURN jsonb_build_object('claimed', true);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.claim_team_intent() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_team_intent() TO authenticated;

-- ── 3. Admin approval, with recorded approver + timestamp ────────────
CREATE OR REPLACE FUNCTION public.approve_team_member(_staff_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  team_role_id uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'only administrators can approve team members';
  END IF;

  SELECT id INTO team_role_id
  FROM public.job_roles
  WHERE title = 'Team' AND active
  LIMIT 1;

  IF team_role_id IS NULL THEN
    RAISE EXCEPTION 'team job role not configured';
  END IF;

  INSERT INTO public.staff_assignments (staff_user_id, job_role_id, assigned_by, approved_by, approved_at)
  VALUES (_staff_id, team_role_id, auth.uid(), auth.uid(), now())
  ON CONFLICT (staff_user_id) DO UPDATE
    SET job_role_id = COALESCE(public.staff_assignments.job_role_id, EXCLUDED.job_role_id),
        approved_by = EXCLUDED.approved_by,
        approved_at = EXCLUDED.approved_at,
        updated_at  = now();

  INSERT INTO public.user_roles (user_id, role)
  VALUES (_staff_id, 'team'::public.app_role)
  ON CONFLICT DO NOTHING;

  UPDATE public.staff_users
  SET status = 'active', updated_at = now()
  WHERE id = _staff_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.approve_team_member(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_team_member(uuid) TO authenticated;

-- ── 4. Events & RSVP access for XCAPE Events tab holders ─────────────
DROP POLICY IF EXISTS "Tab holders view events" ON public.calendar_events;
CREATE POLICY "Tab holders view events" ON public.calendar_events
  FOR SELECT TO authenticated
  USING (
    public.has_section_access(auth.uid(), 'admin-calendar')
    OR (event_type = 'client_event'::public.calendar_event_type
        AND public.has_section_access(auth.uid(), 'xcape-events'))
  );

DROP POLICY IF EXISTS "Tab holders create events" ON public.calendar_events;
CREATE POLICY "Tab holders create events" ON public.calendar_events
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_section_access(auth.uid(), 'admin-calendar')
    OR (event_type = 'client_event'::public.calendar_event_type
        AND public.has_section_access(auth.uid(), 'xcape-events')
        AND created_by = auth.uid())
  );

DROP POLICY IF EXISTS "Tab holders update events" ON public.calendar_events;
CREATE POLICY "Tab holders update events" ON public.calendar_events
  FOR UPDATE TO authenticated
  USING (
    public.has_section_access(auth.uid(), 'admin-calendar')
    OR (event_type = 'client_event'::public.calendar_event_type
        AND public.has_section_access(auth.uid(), 'xcape-events')
        AND created_by = auth.uid())
  )
  WITH CHECK (
    public.has_section_access(auth.uid(), 'admin-calendar')
    OR (event_type = 'client_event'::public.calendar_event_type
        AND public.has_section_access(auth.uid(), 'xcape-events')
        AND created_by = auth.uid())
  );

DROP POLICY IF EXISTS "Managers view invitations" ON public.event_invitations;
CREATE POLICY "Managers view invitations" ON public.event_invitations
  FOR SELECT TO authenticated
  USING (
    public.has_section_access(auth.uid(), 'admin-calendar')
    OR public.has_section_access(auth.uid(), 'xcape-events')
    OR created_by = auth.uid()
  );

DROP POLICY IF EXISTS "Managers create invitations" ON public.event_invitations;
CREATE POLICY "Managers create invitations" ON public.event_invitations
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND (
      public.has_section_access(auth.uid(), 'admin-calendar')
      OR public.has_section_access(auth.uid(), 'xcape-events')
    )
  );

DROP POLICY IF EXISTS "Managers update invitations" ON public.event_invitations;
CREATE POLICY "Managers update invitations" ON public.event_invitations
  FOR UPDATE TO authenticated
  USING (
    public.has_section_access(auth.uid(), 'admin-calendar')
    OR created_by = auth.uid()
  )
  WITH CHECK (
    public.has_section_access(auth.uid(), 'admin-calendar')
    OR created_by = auth.uid()
  );

-- ── 5. Team lead-attribution integrity ───────────────────────────────
DROP POLICY IF EXISTS "Staff with intake can insert clients" ON public.clients;
CREATE POLICY "Staff with intake can insert clients" ON public.clients
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'front_desk'::public.app_role)
    OR public.has_role(auth.uid(), 'medical_aesthetician'::public.app_role)
    OR public.has_role(auth.uid(), 'outreach'::public.app_role)
    -- Team may only create leads attributed to themselves
    OR (public.has_role(auth.uid(), 'team'::public.app_role)
        AND attributed_staff_id = auth.uid())
  );

DROP POLICY IF EXISTS "Team update attributed clients" ON public.clients;
CREATE POLICY "Team update attributed clients" ON public.clients
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'team'::public.app_role) AND attributed_staff_id = auth.uid())
  WITH CHECK (public.has_role(auth.uid(), 'team'::public.app_role) AND attributed_staff_id = auth.uid());