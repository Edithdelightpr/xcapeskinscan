-- Lease-guarded periodic heartbeat for a running worker.
CREATE OR REPLACE FUNCTION public.public_analysis_heartbeat(p_session_id uuid, p_worker_lease uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  s public.public_analysis_sessions%ROWTYPE;
BEGIN
  SELECT * INTO s FROM public.public_analysis_sessions WHERE id = p_session_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'invalid_session');
  END IF;
  IF s.worker_lease IS DISTINCT FROM p_worker_lease THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'stale_worker');
  END IF;
  IF s.status NOT IN ('analyzing','building_report') THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'not_analyzing');
  END IF;

  UPDATE public.public_analysis_sessions
  SET worker_heartbeat_at = now(), updated_at = now()
  WHERE id = s.id;

  RETURN jsonb_build_object('ok', true);
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.public_analysis_heartbeat(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.public_analysis_heartbeat(uuid, uuid) TO service_role;

-- Status now carries a safe, server-computed recovery signal.
CREATE OR REPLACE FUNCTION public.public_analysis_status(p_token_hash text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_stale_after constant interval := interval '4 minutes';
  s public.public_analysis_sessions%ROWTYPE;
  v_stale boolean;
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

  RETURN jsonb_build_object(
    'ok', true,
    'status', s.status,
    'phase', s.phase,
    'verified_views', (SELECT COALESCE(jsonb_agg(k ORDER BY k), '[]'::jsonb)
                       FROM jsonb_object_keys(s.views_captured) AS t(k)),
    'capture_method', s.capture_method,
    'expires_at', s.expires_at,
    'recoverable_stale', COALESCE(v_stale, false)
  );
END;
$function$;
