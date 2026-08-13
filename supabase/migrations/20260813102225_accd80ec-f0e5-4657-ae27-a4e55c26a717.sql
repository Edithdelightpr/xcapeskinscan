-- `min(uuid)` is not available on this Postgres major version; count the
-- candidate matches separately (capped at 2 — we only need to know whether
-- the match is unique) and then fetch the single id.
CREATE OR REPLACE FUNCTION public.public_analysis_claim_lead(p_token_hash text, p_full_name text, p_phone text, p_email text DEFAULT NULL::text, p_consent boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  s public.public_analysis_sessions%ROWTYPE;
  v_name text;
  v_phone text;
  v_email text;
  v_tail text;
  v_client_id uuid;
  v_assessment_id uuid;
  v_match_count int;
  v_owner_id uuid;
  v_now timestamptz := now();
BEGIN
  v_name := left(btrim(coalesce(p_full_name, '')), 120);
  v_phone := left(btrim(coalesce(p_phone, '')), 32);
  v_email := nullif(lower(btrim(coalesce(p_email, ''))), '');

  IF v_name = '' OR v_phone = '' THEN
    RETURN jsonb_build_object('ok', false, 'http', 400, 'error_code', 'invalid_contact');
  END IF;

  SELECT * INTO s
  FROM public.public_analysis_sessions
  WHERE token_hash = p_token_hash
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'http', 401, 'error_code', 'invalid_session');
  END IF;
  IF s.expires_at < v_now OR s.status = 'expired' THEN
    RETURN jsonb_build_object('ok', false, 'http', 410, 'error_code', 'session_expired');
  END IF;
  IF s.status <> 'complete' OR s.engine IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'http', 409, 'error_code', 'report_not_ready');
  END IF;

  -- Exactly idempotent: a claimed session always returns ITS OWN assessment,
  -- but only after proving that assessment still exists and belongs to the
  -- session's client. A dangling or reassigned pointer fails closed.
  IF s.assessment_id IS NOT NULL THEN
    IF s.client_id IS NULL THEN
      RETURN jsonb_build_object(
        'ok', false, 'http', 409, 'error_code', 'claim_incomplete', 'reason', 'orphan_assessment'
      );
    END IF;

    PERFORM 1
    FROM public.client_visit_assessments a
    WHERE a.id = s.assessment_id
      AND a.client_id = s.client_id;

    IF NOT FOUND THEN
      RETURN jsonb_build_object(
        'ok', false, 'http', 409, 'error_code', 'claim_incomplete', 'reason', 'assessment_mismatch'
      );
    END IF;

    RETURN jsonb_build_object(
      'ok', true,
      'client_id', s.client_id,
      'assessment_id', s.assessment_id,
      'already_claimed', true
    );
  END IF;

  -- Backward compatibility for rows claimed before assessment_id existed.
  -- Recovery requires UNAMBIGUOUS PROOF: EXACTLY ONE assessment for this
  -- client carrying this session's exact engine payload, and that assessment
  -- must not already belong to another session. Identical scores across two
  -- assessments are NOT proof, so zero or many fails closed. Never "latest".
  IF s.client_id IS NOT NULL THEN
    SELECT count(*) INTO v_match_count
    FROM (
      SELECT 1
      FROM public.client_visit_assessments a
      WHERE a.client_id = s.client_id
        AND a.skin_analysis -> 'engine' = s.engine
      LIMIT 2
    ) candidates;

    IF v_match_count <> 1 THEN
      RETURN jsonb_build_object(
        'ok', false, 'http', 409, 'error_code', 'claim_incomplete', 'legacy', true,
        'reason', CASE WHEN v_match_count = 0 THEN 'no_match' ELSE 'ambiguous_match' END
      );
    END IF;

    SELECT a.id INTO v_assessment_id
    FROM public.client_visit_assessments a
    WHERE a.client_id = s.client_id
      AND a.skin_analysis -> 'engine' = s.engine
    LIMIT 1;

    SELECT id INTO v_owner_id
    FROM public.public_analysis_sessions
    WHERE assessment_id = v_assessment_id
      AND id <> s.id
    LIMIT 1;

    IF v_owner_id IS NOT NULL THEN
      RETURN jsonb_build_object(
        'ok', false, 'http', 409, 'error_code', 'claim_incomplete', 'legacy', true,
        'reason', 'assessment_owned_by_other_session'
      );
    END IF;

    UPDATE public.public_analysis_sessions
    SET assessment_id = v_assessment_id, updated_at = v_now
    WHERE id = s.id;

    RETURN jsonb_build_object(
      'ok', true,
      'client_id', s.client_id,
      'assessment_id', v_assessment_id,
      'already_claimed', true
    );
  END IF;

  v_tail := right(regexp_replace(v_phone, '\D', '', 'g'), 10);

  SELECT id INTO v_client_id
  FROM public.clients
  WHERE (v_tail <> '' AND phone LIKE '%' || v_tail)
     OR (v_email IS NOT NULL AND lower(email) = v_email)
  ORDER BY created_at ASC
  LIMIT 1;

  IF v_client_id IS NULL THEN
    INSERT INTO public.clients (
      full_name, phone, email, status, source_type,
      marketing_consent, consent_status, consent_captured_at,
      consent_given_at, captured_via
    )
    VALUES (
      v_name, v_phone, v_email, 'lead', 'public_skin_analysis',
      p_consent, CASE WHEN p_consent THEN 'granted' ELSE 'declined' END, v_now,
      CASE WHEN p_consent THEN v_now ELSE NULL END, 'public_skin_analysis'
    )
    RETURNING id INTO v_client_id;
  ELSE
    UPDATE public.clients
    SET full_name = COALESCE(NULLIF(full_name, ''), v_name),
        email = COALESCE(email, v_email),
        marketing_consent = GREATEST(marketing_consent::int, p_consent::int)::boolean,
        consent_status = CASE WHEN p_consent THEN 'granted' ELSE consent_status END,
        consent_captured_at = v_now,
        consent_given_at = CASE WHEN p_consent THEN COALESCE(consent_given_at, v_now) ELSE consent_given_at END
    WHERE id = v_client_id;
  END IF;

  -- One assessment per public session, ALWAYS. Two sessions from the same
  -- contact with byte-identical scores still get their own assessment.
  INSERT INTO public.client_visit_assessments (
    client_id, skin_analysis, skin_analysis_enabled, report_ready,
    main_concern, practitioner_observation
  )
  VALUES (
    v_client_id,
    jsonb_build_object('engine', s.engine),
    true,
    true,
    NULLIF(s.engine ->> 'priority_category', ''),
    'Captured from the XCAPE free public skin analysis. Pending practitioner review.'
  )
  RETURNING id INTO v_assessment_id;

  INSERT INTO public.lead_journey_events (client_id, status, note)
  VALUES (v_client_id, 'public_skin_analysis_completed', 'XCAPE free skin analysis report requested');

  UPDATE public.public_analysis_sessions
  SET client_id = v_client_id,
      assessment_id = v_assessment_id,
      updated_at = v_now
  WHERE id = s.id;

  RETURN jsonb_build_object(
    'ok', true,
    'client_id', v_client_id,
    'assessment_id', v_assessment_id,
    'already_claimed', false
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.public_analysis_claim_lead(text, text, text, text, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.public_analysis_claim_lead(text, text, text, text, boolean) TO service_role;