DO $$
DECLARE
  v_token text := 'verify-p31a-' || gen_random_uuid()::text;
  v_hash text := encode(digest(v_token, 'sha256'), 'hex');
  v_id uuid;
  v_lease_old uuid;
  v_lease_new uuid;
  r jsonb;
BEGIN
  INSERT INTO public.public_analysis_sessions
    (token_hash, status, phase, views_captured, expires_at, purge_at,
     capture_method, analysis_started_at, analysis_attempts, worker_lease, worker_heartbeat_at)
  VALUES
    (v_hash, 'analyzing', 'analyzing_views',
     '{"front":true,"left":true,"right":true}'::jsonb,
     now() + interval '1 hour', now() + interval '2 hours',
     'camera', now(), 1, gen_random_uuid(), now())
  RETURNING id, worker_lease INTO v_id, v_lease_old;

  -- 1. Fresh worker: not recoverable, and not re-claimable.
  r := public.public_analysis_status(v_hash);
  IF (r->>'recoverable_stale')::boolean THEN RAISE EXCEPTION 'FAIL fresh reported stale'; END IF;
  IF r ? 'worker_lease' OR r ? 'worker_heartbeat_at' THEN RAISE EXCEPTION 'FAIL status leaks lease'; END IF;
  r := public.public_analysis_claim_run(v_hash, 'stable-key-0001');
  IF (r->>'claimed')::boolean THEN RAISE EXCEPTION 'FAIL fresh run was displaced'; END IF;

  -- 2. Heartbeat keeps a long provider call alive.
  UPDATE public.public_analysis_sessions SET worker_heartbeat_at = now() - interval '3 minutes' WHERE id = v_id;
  r := public.public_analysis_heartbeat(v_id, v_lease_old);
  IF NOT (r->>'ok')::boolean THEN RAISE EXCEPTION 'FAIL heartbeat rejected for current lease'; END IF;
  r := public.public_analysis_status(v_hash);
  IF (r->>'recoverable_stale')::boolean THEN RAISE EXCEPTION 'FAIL heartbeat did not refresh'; END IF;

  -- 3. Abandoned worker: server reports recoverable.
  UPDATE public.public_analysis_sessions SET worker_heartbeat_at = now() - interval '10 minutes' WHERE id = v_id;
  r := public.public_analysis_status(v_hash);
  IF NOT (r->>'recoverable_stale')::boolean THEN RAISE EXCEPTION 'FAIL stale not reported'; END IF;

  -- 4. Exactly one recovery winner, using the stable key and no retry flag.
  r := public.public_analysis_claim_run(v_hash, 'stable-key-0001');
  IF NOT (r->>'claimed')::boolean THEN RAISE EXCEPTION 'FAIL recovery claim lost'; END IF;
  v_lease_new := (r->>'worker_lease')::uuid;
  IF v_lease_new = v_lease_old THEN RAISE EXCEPTION 'FAIL lease not rotated'; END IF;
  r := public.public_analysis_claim_run(v_hash, 'stable-key-0001');
  IF (r->>'claimed')::boolean THEN RAISE EXCEPTION 'FAIL second recovery also claimed'; END IF;
  r := public.public_analysis_claim_run(v_hash, 'other-key-0002');
  IF (r->>'claimed')::boolean THEN RAISE EXCEPTION 'FAIL different key claimed a live run'; END IF;
  r := public.public_analysis_status(v_hash);
  IF (r->>'recoverable_stale')::boolean THEN RAISE EXCEPTION 'FAIL still stale after recovery'; END IF;

  -- 5. The abandoned worker can no longer act.
  r := public.public_analysis_heartbeat(v_id, v_lease_old);
  IF (r->>'ok')::boolean THEN RAISE EXCEPTION 'FAIL old lease heartbeat accepted'; END IF;
  r := public.public_analysis_set_phase(v_id, 'building_scores', v_lease_old);
  IF (r->>'ok')::boolean THEN RAISE EXCEPTION 'FAIL old lease moved phase'; END IF;
  r := public.public_analysis_fail_run(v_id, 'ai_unavailable', v_lease_old);
  IF (r->>'ok')::boolean THEN RAISE EXCEPTION 'FAIL old lease failed the run'; END IF;

  -- 6. The recovered worker owns the attempt.
  r := public.public_analysis_set_phase(v_id, 'building_scores', v_lease_new);
  IF NOT (r->>'ok')::boolean THEN RAISE EXCEPTION 'FAIL new lease could not move phase'; END IF;

  DELETE FROM public.public_analysis_sessions WHERE id = v_id;
  RAISE NOTICE 'P3.1a recovery verification PASSED';
END $$;
