CREATE OR REPLACE FUNCTION public.public_analysis_status(p_token_hash text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_stale_after constant interval := interval '4 minutes';
  v_keys constant text[] := ARRAY[
    'pigmentation_stability',
    'barrier_surface_hydration',
    'firmness_skin_support',
    'oil_congestion_balance'
  ];
  s public.public_analysis_sessions%ROWTYPE;
  v_stale boolean;
  v_scores jsonb := NULL;
  v_priority text := NULL;
  k text;
  v_raw jsonb;
  v_num numeric;
BEGIN
  SELECT * INTO s FROM public.public_analysis_sessions WHERE token_hash = p_token_hash;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'http', 401, 'error_code', 'invalid_session');
  END IF;
  IF s.expires_at < now() OR s.status = 'expired' THEN
    RETURN jsonb_build_object('ok', false, 'http', 410, 'error_code', 'session_expired');
  END IF;

  v_stale := s.status IN ('analyzing','building_report')
             AND COALESCE(s.worker_heartbeat_at, s.analysis_started_at) IS NOT NULL
             AND COALESCE(s.worker_heartbeat_at, s.analysis_started_at) < now() - v_stale_after;

  -- Only the four health scores, and only once the run is complete. Nothing
  -- else from the engine (notes, ai_raw, evidence, ids, paths) is exposed.
  IF s.status = 'complete' AND s.engine IS NOT NULL THEN
    v_scores := '{}'::jsonb;
    FOREACH k IN ARRAY v_keys LOOP
      v_raw := s.engine -> 'variables' -> k -> 'practitioner_score';
      IF v_raw IS NOT NULL AND jsonb_typeof(v_raw) = 'number' THEN
        v_num := round(GREATEST(0, LEAST(100, (v_raw)::text::numeric)));
        v_scores := v_scores || jsonb_build_object(k, v_num::int);
      END IF;
    END LOOP;
    IF v_scores = '{}'::jsonb THEN
      v_scores := NULL;
    ELSE
      SELECT key INTO v_priority
      FROM jsonb_each(v_scores)
      ORDER BY (value)::text::numeric ASC, key ASC
      LIMIT 1;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'status', s.status,
    'phase', s.phase,
    'verified_views', (SELECT COALESCE(jsonb_agg(k2 ORDER BY k2), '[]'::jsonb)
                       FROM jsonb_object_keys(s.views_captured) AS t(k2)),
    'capture_method', s.capture_method,
    'expires_at', s.expires_at,
    'recoverable_stale', COALESCE(v_stale, false),
    'scores', v_scores,
    'priority_category', v_priority
  );
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.public_analysis_status(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.public_analysis_status(text) TO service_role;