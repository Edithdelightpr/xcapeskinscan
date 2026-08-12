-- 1. Allow the 'mixed' capture method (camera for one view, upload for another)
ALTER TABLE public.public_analysis_sessions
  DROP CONSTRAINT IF EXISTS public_analysis_sessions_capture_method_check;
ALTER TABLE public.public_analysis_sessions
  ADD CONSTRAINT public_analysis_sessions_capture_method_check
  CHECK (capture_method IN ('camera', 'upload', 'mixed'));

-- 2. Atomic, advisory-locked session creation + per-IP hourly rate limit.
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
  _recent integer;
  _row public.public_analysis_sessions%ROWTYPE;
BEGIN
  IF _capture_method NOT IN ('camera', 'upload') THEN
    RAISE EXCEPTION 'invalid capture_method';
  END IF;

  -- Serialise concurrent starts from the same pseudonymised IP for this
  -- transaction, so the count below cannot be raced.
  PERFORM pg_advisory_xact_lock(hashtextextended(_ip_hmac, 0));

  SELECT count(*) INTO _recent
  FROM public.public_analysis_sessions
  WHERE ip_hmac = _ip_hmac
    AND created_at >= now() - interval '1 hour';

  IF _recent >= _max_per_hour THEN
    RETURN QUERY SELECT NULL::uuid, NULL::timestamptz, true;
    RETURN;
  END IF;

  INSERT INTO public.public_analysis_sessions (
    token_hash, status, phase, ip_hmac, ua_hmac, capture_method, expires_at, purge_at
  ) VALUES (
    _token_hash, 'created', 'awaiting_capture', _ip_hmac, _ua_hmac, _capture_method,
    now() + make_interval(secs => _ttl_seconds),
    now() + make_interval(secs => _purge_seconds)
  )
  RETURNING * INTO _row;

  RETURN QUERY SELECT _row.id, _row.expires_at, false;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_public_analysis_session(text, text, text, text, integer, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_public_analysis_session(text, text, text, text, integer, integer, integer) TO service_role;