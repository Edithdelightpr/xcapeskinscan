ALTER TABLE public.public_analysis_sessions
  DROP CONSTRAINT IF EXISTS public_analysis_sessions_capture_method_check;
ALTER TABLE public.public_analysis_sessions
  ADD CONSTRAINT public_analysis_sessions_capture_method_check
  CHECK (capture_method IS NULL OR capture_method = ANY (ARRAY['camera','upload','mixed']));

CREATE INDEX IF NOT EXISTS public_analysis_sessions_ip_created_idx
  ON public.public_analysis_sessions (ip_hmac, created_at DESC);

CREATE OR REPLACE FUNCTION public.create_public_analysis_session(
  _token_hash text,
  _ip_hmac text,
  _ua_hmac text,
  _capture_method text,
  _ttl_seconds integer,
  _purge_seconds integer,
  _max_per_hour integer
)
RETURNS TABLE (session_id uuid, expires_at timestamptz, rate_limited boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
  v_id uuid;
  v_expires timestamptz;
BEGIN
  IF _capture_method NOT IN ('camera','upload') THEN
    RAISE EXCEPTION 'invalid capture_method';
  END IF;

  -- Serialize concurrent starts from the same pseudonymised IP so the
  -- hourly ceiling cannot be bypassed by parallel requests.
  PERFORM pg_advisory_xact_lock(hashtext('public_analysis_start:' || _ip_hmac));

  SELECT count(*) INTO v_count
  FROM public.public_analysis_sessions s
  WHERE s.ip_hmac = _ip_hmac AND s.created_at >= now() - interval '1 hour';

  IF v_count >= _max_per_hour THEN
    RETURN QUERY SELECT NULL::uuid, NULL::timestamptz, true;
    RETURN;
  END IF;

  v_expires := now() + make_interval(secs => _ttl_seconds);

  INSERT INTO public.public_analysis_sessions
    (token_hash, status, phase, ip_hmac, ua_hmac, capture_method, expires_at, purge_at)
  VALUES
    (_token_hash, 'created', 'awaiting_capture', _ip_hmac, _ua_hmac, _capture_method,
     v_expires, now() + make_interval(secs => _purge_seconds))
  RETURNING id INTO v_id;

  RETURN QUERY SELECT v_id, v_expires, false;
END;
$$;

REVOKE ALL ON FUNCTION public.create_public_analysis_session(text,text,text,text,integer,integer,integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_public_analysis_session(text,text,text,text,integer,integer,integer) TO service_role;