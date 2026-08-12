
DO $$
DECLARE
  v_id uuid;
  r jsonb;
  lease1 uuid;
  lease2 uuid;
BEGIN
  DELETE FROM public.public_analysis_sessions WHERE token_hash = 'p31_verify_hash';

  INSERT INTO public.public_analysis_sessions (token_hash, expires_at, purge_at, status, views_captured, capture_method)
  VALUES ('p31_verify_hash', now() + interval '1 hour', now() + interval '1 hour', 'queued',
          '{"front":{},"left":{},"right":{}}'::jsonb, 'camera')
  RETURNING id INTO v_id;

  -- 1. First claim wins and gets a lease.
  r := public.public_analysis_claim_run('p31_verify_hash','key-aaaaaaaa');
  IF NOT (r->>'claimed')::boolean THEN RAISE EXCEPTION 'expected first claim: %', r; END IF;
  lease1 := (r->>'worker_lease')::uuid;

  -- 2. Same key while analyzing is idempotent (no new attempt).
  r := public.public_analysis_claim_run('p31_verify_hash','key-aaaaaaaa');
  IF (r->>'claimed')::boolean THEN RAISE EXCEPTION 'same key restarted the run'; END IF;

  -- 3. A different key cannot restart an active run.
  r := public.public_analysis_claim_run('p31_verify_hash','key-bbbbbbbb');
  IF (r->>'claimed')::boolean THEN RAISE EXCEPTION 'different key restarted the run'; END IF;

  -- 4. Heartbeats keep a legitimate long-running job alive.
  UPDATE public.public_analysis_sessions SET analysis_started_at = now() - interval '30 minutes' WHERE id = v_id;
  r := public.public_analysis_set_phase(v_id, 'analyzing_views', lease1);
  IF NOT (r->>'ok')::boolean THEN RAISE EXCEPTION 'legit worker phase rejected: %', r; END IF;
  r := public.public_analysis_claim_run('p31_verify_hash','key-cccccccc');
  IF (r->>'claimed')::boolean THEN RAISE EXCEPTION 'fresh heartbeat treated as stale'; END IF;

  -- 5. A wrong lease can neither move a phase nor finish the run.
  IF (public.public_analysis_set_phase(v_id, 'building_scores', gen_random_uuid())->>'error_code') <> 'stale_worker'
    THEN RAISE EXCEPTION 'stale worker moved a phase'; END IF;
  IF (public.public_analysis_complete_run(v_id, '{}'::jsonb, 'v', 'v', '{}'::jsonb, gen_random_uuid())->>'error_code') <> 'stale_worker'
    THEN RAISE EXCEPTION 'stale worker completed the run'; END IF;
  IF (public.public_analysis_fail_run(v_id, 'x', gen_random_uuid())->>'error_code') <> 'stale_worker'
    THEN RAISE EXCEPTION 'stale worker failed the run'; END IF;

  -- 6. A stale worker (no heartbeat) is reclaimed with a NEW lease.
  UPDATE public.public_analysis_sessions
  SET worker_heartbeat_at = now() - interval '30 minutes' WHERE id = v_id;
  r := public.public_analysis_claim_run('p31_verify_hash','key-dddddddd');
  IF NOT (r->>'claimed')::boolean THEN RAISE EXCEPTION 'stale job was not reclaimed'; END IF;
  lease2 := (r->>'worker_lease')::uuid;
  IF lease2 = lease1 THEN RAISE EXCEPTION 'reclaim reused the old lease'; END IF;

  -- 7. The old worker cannot complete or fail the reclaimed attempt.
  IF (public.public_analysis_complete_run(v_id, '{}'::jsonb, 'v', 'v', '{}'::jsonb, lease1)->>'error_code') <> 'stale_worker'
    THEN RAISE EXCEPTION 'old worker completed a reclaimed attempt'; END IF;

  -- 8. Failed stays failed without an explicit retry.
  r := public.public_analysis_fail_run(v_id, 'ai_unavailable', lease2);
  IF NOT (r->>'ok')::boolean THEN RAISE EXCEPTION 'legit worker could not fail the run'; END IF;
  r := public.public_analysis_claim_run('p31_verify_hash','key-eeeeeeee');
  IF (r->>'claimed')::boolean THEN RAISE EXCEPTION 'failed run auto-retried'; END IF;
  IF (r->>'status') <> 'failed' THEN RAISE EXCEPTION 'failed status not reported: %', r; END IF;

  -- 9. Explicit retry is attempt-limited (3 attempts total: 2 used).
  r := public.public_analysis_claim_run('p31_verify_hash','key-ffffffff', true);
  IF NOT (r->>'claimed')::boolean THEN RAISE EXCEPTION 'explicit retry did not claim'; END IF;
  -- A concurrent second retry click cannot claim a second attempt.
  r := public.public_analysis_claim_run('p31_verify_hash','key-gggggggg', true);
  IF (r->>'claimed')::boolean THEN RAISE EXCEPTION 'double retry claimed twice'; END IF;

  -- 10. Completion is final and never restarted.
  r := public.public_analysis_complete_run(v_id, '{}'::jsonb, 'v', 'v', '{}'::jsonb,
        (SELECT worker_lease FROM public.public_analysis_sessions WHERE id = v_id));
  IF NOT (r->>'ok')::boolean THEN RAISE EXCEPTION 'completion failed: %', r; END IF;
  r := public.public_analysis_claim_run('p31_verify_hash','key-hhhhhhhh', true);
  IF (r->>'claimed')::boolean THEN RAISE EXCEPTION 'completed run restarted'; END IF;

  DELETE FROM public.public_analysis_sessions WHERE id = v_id;
  RAISE NOTICE 'P3.1 lease + idempotency verification passed';
END $$;
