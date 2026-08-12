-- P2.1: transactional, service-role-only helpers for the anonymous public
-- skin-analysis capture step. All state transitions happen under a row lock
-- so concurrent per-view requests can never lose JSON state or paths.

CREATE OR REPLACE FUNCTION public.public_analysis_issue_view(
  p_token_hash text,
  p_view text
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_max_view_attempts constant int := 4;
  v_max_session_attempts constant int := 10;
  s public.public_analysis_sessions%ROWTYPE;
  v_path text;
  v_view_attempts int;
  v_paths jsonb;
BEGIN
  IF p_view NOT IN ('front','left','right') THEN
    RETURN jsonb_build_object('ok', false, 'http', 400, 'error_code', 'invalid_view');
  END IF;

  SELECT * INTO s FROM public.public_analysis_sessions
  WHERE token_hash = p_token_hash
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'http', 401, 'error_code', 'invalid_session');
  END IF;

  IF s.expires_at < now() OR s.status = 'expired' THEN
    RETURN jsonb_build_object('ok', false, 'http', 410, 'error_code', 'session_expired');
  END IF;

  IF s.views_captured ? p_view THEN
    RETURN jsonb_build_object('ok', false, 'http', 409, 'error_code', 'already_captured');
  END IF;

  IF s.status NOT IN ('created','uploading') THEN
    RETURN jsonb_build_object('ok', false, 'http', 409, 'error_code', 'not_accepting');
  END IF;

  v_view_attempts := COALESCE(((s.views_issued -> p_view) ->> 'attempts')::int, 0);

  IF v_view_attempts >= v_max_view_attempts THEN
    RETURN jsonb_build_object('ok', false, 'http', 429, 'error_code', 'view_attempts_exhausted',
      'view_attempts', v_view_attempts, 'max_view_attempts', v_max_view_attempts);
  END IF;

  IF s.attempt_count >= v_max_session_attempts THEN
    RETURN jsonb_build_object('ok', false, 'http', 429, 'error_code', 'session_attempts_exhausted',
      'session_attempts', s.attempt_count, 'max_session_attempts', v_max_session_attempts);
  END IF;

  v_path := s.id::text || '/' || p_view || '.jpg';

  SELECT COALESCE(jsonb_agg(DISTINCT p), '[]'::jsonb) INTO v_paths
  FROM jsonb_array_elements(s.image_paths || to_jsonb(ARRAY[v_path])) AS t(p);

  UPDATE public.public_analysis_sessions
  SET status = 'uploading',
      phase = 'capturing_' || p_view,
      views_issued = views_issued || jsonb_build_object(
        p_view, jsonb_build_object(
          'last_issued_at', to_jsonb(now()),
          'attempts', v_view_attempts + 1
        )
      ),
      image_paths = v_paths,
      attempt_count = attempt_count + 1,
      images_purge_at = now() + interval '24 hours',
      updated_at = now()
  WHERE id = s.id;

  RETURN jsonb_build_object(
    'ok', true,
    'session_id', s.id,
    'view', p_view,
    'path', v_path,
    'view_attempts', v_view_attempts + 1,
    'session_attempts', s.attempt_count + 1,
    'max_view_attempts', v_max_view_attempts,
    'max_session_attempts', v_max_session_attempts
  );
END;
$$;

-- Read-only resolve used before downloading the object for verification.
CREATE OR REPLACE FUNCTION public.public_analysis_resolve_view(
  p_token_hash text,
  p_view text
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  s public.public_analysis_sessions%ROWTYPE;
  v_all boolean;
BEGIN
  IF p_view NOT IN ('front','left','right') THEN
    RETURN jsonb_build_object('ok', false, 'http', 400, 'error_code', 'invalid_view');
  END IF;

  SELECT * INTO s FROM public.public_analysis_sessions WHERE token_hash = p_token_hash;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'http', 401, 'error_code', 'invalid_session');
  END IF;
  IF s.expires_at < now() OR s.status = 'expired' THEN
    RETURN jsonb_build_object('ok', false, 'http', 410, 'error_code', 'session_expired');
  END IF;

  v_all := (s.views_captured ? 'front') AND (s.views_captured ? 'left') AND (s.views_captured ? 'right');

  IF s.views_captured ? p_view THEN
    RETURN jsonb_build_object('ok', true, 'already_verified', true, 'all_verified', v_all,
      'session_id', s.id, 'path', s.id::text || '/' || p_view || '.jpg');
  END IF;

  IF s.status NOT IN ('created','uploading') THEN
    RETURN jsonb_build_object('ok', false, 'http', 409, 'error_code', 'not_accepting');
  END IF;

  RETURN jsonb_build_object('ok', true, 'already_verified', false, 'all_verified', false,
    'session_id', s.id, 'path', s.id::text || '/' || p_view || '.jpg');
END;
$$;

-- Atomic commit of a verified view.
CREATE OR REPLACE FUNCTION public.public_analysis_commit_view(
  p_token_hash text,
  p_view text,
  p_meta jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  s public.public_analysis_sessions%ROWTYPE;
  v_path text;
  v_paths jsonb;
  v_captured jsonb;
  v_all boolean;
  v_sources text[];
  v_method text;
  v_status text;
  v_phase text;
BEGIN
  IF p_view NOT IN ('front','left','right') THEN
    RETURN jsonb_build_object('ok', false, 'http', 400, 'error_code', 'invalid_view');
  END IF;

  SELECT * INTO s FROM public.public_analysis_sessions
  WHERE token_hash = p_token_hash
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'http', 401, 'error_code', 'invalid_session');
  END IF;
  IF s.expires_at < now() OR s.status = 'expired' THEN
    RETURN jsonb_build_object('ok', false, 'http', 410, 'error_code', 'session_expired');
  END IF;

  v_all := (s.views_captured ? 'front') AND (s.views_captured ? 'left') AND (s.views_captured ? 'right');

  -- Idempotent: a verified view is final.
  IF s.views_captured ? p_view THEN
    RETURN jsonb_build_object('ok', true, 'already_verified', true, 'all_verified', v_all,
      'status', s.status, 'phase', s.phase,
      'verified_views', (SELECT COALESCE(jsonb_agg(k ORDER BY k), '[]'::jsonb)
                         FROM jsonb_object_keys(s.views_captured) AS t(k)));
  END IF;

  IF s.status NOT IN ('created','uploading') THEN
    RETURN jsonb_build_object('ok', false, 'http', 409, 'error_code', 'not_accepting');
  END IF;

  v_path := s.id::text || '/' || p_view || '.jpg';
  v_captured := s.views_captured || jsonb_build_object(p_view, p_meta);

  SELECT COALESCE(jsonb_agg(DISTINCT p), '[]'::jsonb) INTO v_paths
  FROM jsonb_array_elements(s.image_paths || to_jsonb(ARRAY[v_path])) AS t(p);

  v_all := (v_captured ? 'front') AND (v_captured ? 'left') AND (v_captured ? 'right');

  SELECT array_agg(DISTINCT src) INTO v_sources
  FROM (SELECT (value ->> 'source') AS src FROM jsonb_each(v_captured)) q
  WHERE src IS NOT NULL;

  IF v_sources IS NULL OR array_length(v_sources, 1) IS NULL THEN
    v_method := s.capture_method;
  ELSIF array_length(v_sources, 1) > 1 THEN
    v_method := 'mixed';
  ELSE
    v_method := v_sources[1];
  END IF;

  v_status := CASE WHEN v_all THEN 'queued' ELSE 'uploading' END;
  v_phase := CASE WHEN v_all THEN 'capture_complete' ELSE 'capturing_' || p_view END;

  UPDATE public.public_analysis_sessions
  SET views_captured = v_captured,
      image_paths = v_paths,
      capture_method = v_method,
      status = v_status,
      phase = v_phase,
      images_purge_at = now() + interval '24 hours',
      updated_at = now()
  WHERE id = s.id;

  RETURN jsonb_build_object('ok', true, 'already_verified', false, 'all_verified', v_all,
    'status', v_status, 'phase', v_phase,
    'verified_views', (SELECT COALESCE(jsonb_agg(k ORDER BY k), '[]'::jsonb)
                       FROM jsonb_object_keys(v_captured) AS t(k)));
END;
$$;

-- Strictly whitelisted progress lookup. Never exposes ids, paths, images,
-- engine output or ai_raw.
CREATE OR REPLACE FUNCTION public.public_analysis_status(p_token_hash text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  s public.public_analysis_sessions%ROWTYPE;
BEGIN
  SELECT * INTO s FROM public.public_analysis_sessions WHERE token_hash = p_token_hash;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'http', 401, 'error_code', 'invalid_session');
  END IF;
  IF s.expires_at < now() OR s.status = 'expired' THEN
    RETURN jsonb_build_object('ok', false, 'http', 410, 'error_code', 'session_expired');
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'status', s.status,
    'phase', s.phase,
    'verified_views', (SELECT COALESCE(jsonb_agg(k ORDER BY k), '[]'::jsonb)
                       FROM jsonb_object_keys(s.views_captured) AS t(k)),
    'capture_method', s.capture_method,
    'expires_at', s.expires_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.public_analysis_issue_view(text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.public_analysis_resolve_view(text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.public_analysis_commit_view(text, text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.public_analysis_status(text) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.public_analysis_issue_view(text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.public_analysis_resolve_view(text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.public_analysis_commit_view(text, text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.public_analysis_status(text) TO service_role;