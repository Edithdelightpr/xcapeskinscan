CREATE OR REPLACE FUNCTION public.public_analysis_report(p_token_hash text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_keys constant text[] := ARRAY[
    'pigmentation_stability',
    'barrier_surface_hydration',
    'firmness_skin_support',
    'oil_congestion_balance'
  ];
  s public.public_analysis_sessions%ROWTYPE;
  v_vars jsonb := '{}'::jsonb;
  v_order jsonb := '[]'::jsonb;
  v_home jsonb := '[]'::jsonb;
  v_treat jsonb := '[]'::jsonb;
  k text;
  v_raw jsonb;
  v_note text;
  v_score int;
  v_item text;
BEGIN
  SELECT * INTO s FROM public.public_analysis_sessions WHERE token_hash = p_token_hash;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'http', 401, 'error_code', 'invalid_session');
  END IF;
  IF s.expires_at < now() OR s.status = 'expired' THEN
    RETURN jsonb_build_object('ok', false, 'http', 410, 'error_code', 'session_expired');
  END IF;
  IF s.status <> 'complete' OR s.engine IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'http', 409, 'error_code', 'report_not_ready');
  END IF;

  FOREACH k IN ARRAY v_keys LOOP
    v_raw := s.engine -> 'variables' -> k -> 'practitioner_score';
    IF v_raw IS NULL OR jsonb_typeof(v_raw) <> 'number' THEN
      CONTINUE;
    END IF;
    v_score := round(GREATEST(0, LEAST(100, (v_raw)::text::numeric)))::int;
    v_note := NULL;
    IF jsonb_typeof(s.engine -> 'variables' -> k -> 'note') = 'string' THEN
      v_note := left(btrim(s.engine -> 'variables' -> k ->> 'note'), 400);
      IF v_note = '' THEN v_note := NULL; END IF;
    END IF;
    v_vars := v_vars || jsonb_build_object(k, jsonb_build_object('score', v_score, 'note', v_note));
  END LOOP;

  IF v_vars = '{}'::jsonb THEN
    RETURN jsonb_build_object('ok', false, 'http', 409, 'error_code', 'report_not_ready');
  END IF;

  IF jsonb_typeof(s.engine -> 'priority_order') = 'array' THEN
    SELECT COALESCE(jsonb_agg(e.val), '[]'::jsonb) INTO v_order
    FROM (
      SELECT value #>> '{}' AS val, ordinality
      FROM jsonb_array_elements(s.engine -> 'priority_order') WITH ORDINALITY AS t(value, ordinality)
    ) e
    WHERE e.val = ANY (v_keys);
  END IF;

  IF jsonb_typeof(s.engine -> 'recommended_home_care_directions') = 'array' THEN
    SELECT COALESCE(jsonb_agg(left(v, 300) ORDER BY ord), '[]'::jsonb) INTO v_home
    FROM (
      SELECT value #>> '{}' AS v, ordinality AS ord
      FROM jsonb_array_elements(s.engine -> 'recommended_home_care_directions') WITH ORDINALITY AS t(value, ordinality)
    ) q
    WHERE v IS NOT NULL AND btrim(v) <> '';
  END IF;

  IF jsonb_typeof(s.engine -> 'recommended_treatment_directions') = 'array' THEN
    SELECT COALESCE(jsonb_agg(left(v, 300) ORDER BY ord), '[]'::jsonb) INTO v_treat
    FROM (
      SELECT value #>> '{}' AS v, ordinality AS ord
      FROM jsonb_array_elements(s.engine -> 'recommended_treatment_directions') WITH ORDINALITY AS t(value, ordinality)
    ) q
    WHERE v IS NOT NULL AND btrim(v) <> '';
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'variables', v_vars,
    'priority_order', v_order,
    'overall_skin_stability',
      CASE WHEN jsonb_typeof(s.engine -> 'overall_skin_stability') = 'number'
        THEN round(GREATEST(0, LEAST(100, (s.engine ->> 'overall_skin_stability')::numeric)))::int
        ELSE NULL END,
    'combined_interpretation',
      CASE WHEN jsonb_typeof(s.engine -> 'combined_interpretation') = 'string'
        THEN left(s.engine ->> 'combined_interpretation', 500) ELSE NULL END,
    'home_care_directions', v_home,
    'treatment_directions', v_treat
  );
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.public_analysis_report(text) FROM PUBLIC, anon, authenticated;