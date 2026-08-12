
ALTER TABLE public.public_analysis_sessions
  ADD COLUMN IF NOT EXISTS worker_lease uuid,
  ADD COLUMN IF NOT EXISTS worker_heartbeat_at timestamptz;

-- ── Claim / retry ──────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.public_analysis_claim_run(text, text);

CREATE OR REPLACE FUNCTION public.public_analysis_claim_run(
  p_token_hash text,
  p_idempotency_key text,
  p_retry boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  -- Conservative: a live worker heartbeats on every real phase transition.
  v_stale_after constant interval := interval '4 minutes';
  v_max_attempts constant int := 3;
  s public.public_analysis_sessions%ROWTYPE;
  v_all boolean;
  v_stale boolean;
  v_lease uuid;
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

  -- Completed work is never restarted, by any key and by any retry.
  IF s.status = 'complete' THEN
    RETURN jsonb_build_object('ok', true, 'claimed', false, 'status', s.status, 'phase', s.phase);
  END IF;

  v_stale := s.status IN ('analyzing','building_report')
             AND COALESCE(s.worker_heartbeat_at, s.analysis_started_at) IS NOT NULL
             AND COALESCE(s.worker_heartbeat_at, s.analysis_started_at) < now() - v_stale_after;

  -- A live worker owns the run: no key and no retry may displace it.
  IF s.status IN ('analyzing','building_report') AND NOT v_stale THEN
    RETURN jsonb_build_object('ok', true, 'claimed', false, 'status', s.status, 'phase', s.phase);
  END IF;

  -- A failed run stays failed until the visitor explicitly retries.
  IF s.status = 'failed' AND NOT COALESCE(p_retry, false) THEN
    RETURN jsonb_build_object('ok', true, 'claimed', false, 'status', 'failed', 'phase', s.phase,
                              'failure_code', s.failure_code);
  END IF;

  IF s.analysis_attempts >= v_max_attempts THEN
    UPDATE public.public_analysis_sessions
    SET status = 'failed', phase = null, worker_lease = null,
        failure_code = COALESCE(failure_code, 'analysis_attempts_exhausted'),
        updated_at = now()
    WHERE id = s.id;
    RETURN jsonb_build_object('ok', false, 'http', 429, 'error_code', 'analysis_attempts_exhausted');
  END IF;

  v_lease := gen_random_uuid();

  UPDATE public.public_analysis_sessions
  SET status = 'analyzing',
      phase = 'preparing_images',
      -- First key wins; an explicit retry adopts the retry key.
      idempotency_key = CASE
        WHEN COALESCE(p_retry, false) THEN p_idempotency_key
        ELSE COALESCE(idempotency_key, p_idempotency_key)
      END,
      worker_lease = v_lease,
      worker_heartbeat_at = now(),
      analysis_started_at = now(),
      analysis_attempts = analysis_attempts + 1,
      failure_code = null,
      updated_at = now()
  WHERE id = s.id;

  RETURN jsonb_build_object(
    'ok', true,
    'claimed', true,
    'session_id', s.id,
    'worker_lease', v_lease,
    'status', 'analyzing',
    'phase', 'preparing_images',
    'resumed_stale', v_stale
  );
END;
$function$;

-- ── Phase heartbeat ────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.public_analysis_set_phase(uuid, text);

CREATE OR REPLACE FUNCTION public.public_analysis_set_phase(
  p_session_id uuid,
  p_phase text,
  p_worker_lease uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  s public.public_analysis_sessions%ROWTYPE;
BEGIN
  IF p_phase NOT IN ('preparing_images','analyzing_views','building_scores','analysis_complete') THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'invalid_phase');
  END IF;

  SELECT * INTO s FROM public.public_analysis_sessions WHERE id = p_session_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'invalid_session');
  END IF;
  IF s.worker_lease IS DISTINCT FROM p_worker_lease THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'stale_worker');
  END IF;
  IF s.status <> 'analyzing' THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'not_analyzing');
  END IF;

  UPDATE public.public_analysis_sessions
  SET phase = p_phase, worker_heartbeat_at = now(), updated_at = now()
  WHERE id = s.id;

  RETURN jsonb_build_object('ok', true, 'phase', p_phase);
END;
$function$;

-- ── Terminal transitions (lease-guarded, row-locked) ───────────────────────
DROP FUNCTION IF EXISTS public.public_analysis_complete_run(uuid, jsonb, text, text, jsonb);

CREATE OR REPLACE FUNCTION public.public_analysis_complete_run(
  p_session_id uuid,
  p_engine jsonb,
  p_engine_version text,
  p_prompt_version text,
  p_ai_result jsonb,
  p_worker_lease uuid
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
  -- An older worker can never finish a reclaimed attempt.
  IF s.worker_lease IS DISTINCT FROM p_worker_lease THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'stale_worker');
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
      worker_heartbeat_at = now(),
      worker_lease = null,
      failure_code = null,
      updated_at = now()
  WHERE id = s.id;

  RETURN jsonb_build_object('ok', true);
END;
$function$;

DROP FUNCTION IF EXISTS public.public_analysis_fail_run(uuid, text);

CREATE OR REPLACE FUNCTION public.public_analysis_fail_run(
  p_session_id uuid,
  p_failure_code text,
  p_worker_lease uuid
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
  IF s.worker_lease IS DISTINCT FROM p_worker_lease THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'stale_worker');
  END IF;

  UPDATE public.public_analysis_sessions
  SET status = 'failed',
      phase = null,
      worker_lease = null,
      worker_heartbeat_at = now(),
      failure_code = COALESCE(NULLIF(p_failure_code, ''), 'analysis_failed'),
      updated_at = now()
  WHERE id = s.id;

  RETURN jsonb_build_object('ok', true);
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.public_analysis_claim_run(text, text, boolean) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.public_analysis_set_phase(uuid, text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.public_analysis_complete_run(uuid, jsonb, text, text, jsonb, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.public_analysis_fail_run(uuid, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.public_analysis_claim_run(text, text, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.public_analysis_set_phase(uuid, text, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.public_analysis_complete_run(uuid, jsonb, text, text, jsonb, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.public_analysis_fail_run(uuid, text, uuid) TO service_role;
