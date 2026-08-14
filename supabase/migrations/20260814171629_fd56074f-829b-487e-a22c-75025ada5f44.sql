CREATE OR REPLACE FUNCTION public.set_xcape_partner_status(_org_id uuid, _status text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_kind text;
  v_members uuid[];
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'only administrators can change partner status';
  END IF;
  IF _status NOT IN ('active','pending','suspended') THEN
    RAISE EXCEPTION 'unsupported status %', _status;
  END IF;

  SELECT kind INTO v_kind FROM public.organizations WHERE id = _org_id;
  IF v_kind IS NULL THEN RAISE EXCEPTION 'organization not found'; END IF;

  UPDATE public.organizations
  SET status = _status, updated_at = now()
  WHERE id = _org_id;

  UPDATE public.organization_members
  SET status = CASE WHEN _status = 'active' THEN 'active' ELSE 'suspended' END
  WHERE organization_id = _org_id
  RETURNING user_id INTO v_members;

  SELECT array_agg(user_id) INTO v_members
  FROM public.organization_members WHERE organization_id = _org_id;

  -- Activation is what actually lets an approved partner into the workspace;
  -- without it the account stays stuck on the "under review" screen.
  IF _status = 'active' THEN
    UPDATE public.staff_users
    SET status = 'active'::public.staff_status, updated_at = now()
    WHERE id = ANY(COALESCE(v_members, ARRAY[]::uuid[]))
      AND status <> 'active';
  ELSE
    UPDATE public.staff_users s
    SET status = 'inactive'::public.staff_status, updated_at = now()
    WHERE s.id = ANY(COALESCE(v_members, ARRAY[]::uuid[]))
      AND NOT public.has_role(s.id, 'admin'::public.app_role)
      AND NOT EXISTS (
        SELECT 1 FROM public.organization_members m
        JOIN public.organizations o ON o.id = m.organization_id
        WHERE m.user_id = s.id AND m.organization_id <> _org_id
          AND m.status = 'active' AND o.status = 'active'
      );
  END IF;

  RETURN jsonb_build_object('organization_id', _org_id, 'status', _status);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.set_xcape_partner_status(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_xcape_partner_status(uuid, text) TO authenticated;