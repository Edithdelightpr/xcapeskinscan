ALTER TABLE public.public_analysis_sessions
  ADD COLUMN IF NOT EXISTS analysis_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS analysis_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS analysis_attempts integer NOT NULL DEFAULT 0;

-- ── Claim (or resume) the single analysis job for a session ──────────────
CREATE OR REPLACE FUNCTION public.public_analysis_claim_run(
  p_token_hash text,
  p_idempotency_key text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_stale_after constant interval := interval '3 minutes';
  v_max_attempts constant int := 3;
  s public.public_analysis_sessions%ROWTYPE;
  v_all boolean;
  v_stale boolean;
BEGIN
  IF p_idempotency_key IS NULL OR length(p_idempotency_key) < 8 OR length(p_idempotency_key) > 100 THEN
    RETURN jsonb_build_object('ok', false, 'http', 400, 'error_code', 'invalid_idempotency_key');
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
  IF NOT v_all THEN
    RETURN jsonb_build_object('ok', false, 'http', 409, 'error_code', 'incomplete_capture');
  END IF;

  IF s.status = 'complete' THEN
    RETURN jsonb_build_object('ok', true, 'claimed', false, 'status', s.status, 'phase', s.phase);
  END IF;

  v_stale := s.status IN ('analyzing','building_report')
             AND (s.analysis_started_at IS NULL OR s.analysis_started_at < now() - v_stale_after);

  IF s.status IN ('analyzing','building_report') AND NOT v_stale THEN
    RETURN jsonb_build_object('ok', true, 'claimed', false, 'status', s.status, 'phase', s.phase);
  END IF;

  IF s.analysis_attempts >= v_max_attempts THEN
    UPDATE public.public_analysis_sessions
    SET status = 'failed', phase = null,
        failure_code = COALESCE(failure_code, 'analysis_attempts_exhausted'),
        updated_at = now()
    WHERE id = s.id;
    RETURN jsonb_build_object('ok', false, 'http', 429, 'error_code', 'analysis_attempts_exhausted');
  END IF;

  UPDATE public.public_analysis_sessions
  SET status = 'analyzing',
      phase = 'preparing_images',
      idempotency_key = COALESCE(idempotency_key, p_idempotency_key),
      analysis_started_at = now(),
      analysis_attempts = analysis_attempts + 1,
      failure_code = null,
      updated_at = now()
  WHERE id = s.id;

  RETURN jsonb_build_object(
    'ok', true,
    'claimed', true,
    'session_id', s.id,
    'status', 'analyzing',
    'phase', 'preparing_images',
    'resumed_stale', v_stale
  );
END;
$function$;

-- ── Phase progression while the worker runs ──────────────────────────────
CREATE OR REPLACE FUNCTION public.public_analysis_set_phase(
  p_session_id uuid,
  p_phase text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF p_phase NOT IN ('preparing_images','analyzing_views','building_scores','analysis_complete') THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'invalid_phase');
  END IF;

  UPDATE public.public_analysis_sessions
  SET phase = p_phase, updated_at = now()
  WHERE id = p_session_id AND status = 'analyzing';

  RETURN jsonb_build_object('ok', true, 'phase', p_phase);
END;
$function$;

-- ── Successful completion: store sanitized engine + validated AI only ────
CREATE OR REPLACE FUNCTION public.public_analysis_complete_run(
  p_session_id uuid,
  p_engine jsonb,
  p_engine_version text,
  p_prompt_version text,
  p_ai_result jsonb
)
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
  IF s.status = 'complete' THEN
    RETURN jsonb_build_object('ok', true, 'already_complete', true);
  END IF;

  UPDATE public.public_analysis_sessions
  SET status = 'complete',
      phase = 'analysis_complete',
      engine = p_engine,
      engine_version = p_engine_version,
      prompt_version = p_prompt_version,
      ai_raw = p_ai_result,
      ai_raw_purge_at = now() + interval '24 hours',
      analysis_completed_at = now(),
      failure_code = null,
      updated_at = now()
  WHERE id = s.id;

  RETURN jsonb_build_object('ok', true);
END;
$function$;

-- ── Structured failure ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.public_analysis_fail_run(
  p_session_id uuid,
  p_failure_code text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  UPDATE public.public_analysis_sessions
  SET status = 'failed',
      phase = null,
      failure_code = COALESCE(NULLIF(p_failure_code, ''), 'analysis_failed'),
      updated_at = now()
  WHERE id = p_session_id AND status <> 'complete';

  RETURN jsonb_build_object('ok', true);
END;
$function$;

REVOKE ALL ON FUNCTION public.public_analysis_claim_run(text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.public_analysis_set_phase(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.public_analysis_complete_run(uuid, jsonb, text, text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.public_analysis_fail_run(uuid, text) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.public_analysis_claim_run(text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.public_analysis_set_phase(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.public_analysis_complete_run(uuid, jsonb, text, text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.public_analysis_fail_run(uuid, text) TO service_role;