-- =====================================================================
-- XCAPE public skin-analysis demo — P1 backend foundation
-- Tables live in `public` (the only Data-API-reachable schema for the
-- edge functions' service-role client) but ALL privileges are revoked
-- from anon/authenticated; RLS is enabled with no policies, so the only
-- access path is a service-role edge function.
-- =====================================================================

CREATE TABLE public.public_analysis_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- SHA-256 of the raw session token. The raw token is never stored/logged.
  token_hash text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'created',
  phase text,
  -- Per-view capture bookkeeping: { "front": {"uploaded_at": "..."} , ... }
  views_captured jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- Storage object paths inside the private xcape-public-demo bucket.
  image_paths jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- Engine output (added in a later phase) + provenance.
  engine jsonb,
  engine_version text,
  prompt_version text,
  -- Optional short-TTL debugging payload; purged by images/ai deadline.
  ai_raw jsonb,
  ai_raw_purge_at timestamptz,
  -- Idempotency + retry bookkeeping for the analysis run.
  idempotency_key text,
  attempt_count integer NOT NULL DEFAULT 0,
  failure_code text,
  -- Keyed HMAC pseudonyms (never plain hashes, never raw IP/UA).
  ip_hmac text,
  ua_hmac text,
  -- Set only once a visitor asks for delivery and becomes a real lead.
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  delivered_at timestamptz,
  delivery_channel text,
  images_purge_at timestamptz,
  expires_at timestamptz NOT NULL,
  purge_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT public_analysis_sessions_status_check CHECK (
    status IN ('created','uploading','queued','analyzing','building_report','complete','failed','expired')
  ),
  CONSTRAINT public_analysis_sessions_channel_check CHECK (
    delivery_channel IS NULL OR delivery_channel IN ('whatsapp','email')
  )
);

REVOKE ALL ON public.public_analysis_sessions FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.public_analysis_sessions TO service_role;
ALTER TABLE public.public_analysis_sessions ENABLE ROW LEVEL SECURITY;
-- Intentionally no policies: anon/authenticated have no grants and no policy,
-- so every read/write must go through a service-role edge function.

CREATE INDEX idx_pas_token_hash ON public.public_analysis_sessions (token_hash);
CREATE INDEX idx_pas_images_purge ON public.public_analysis_sessions (images_purge_at)
  WHERE images_purge_at IS NOT NULL;
CREATE INDEX idx_pas_purge_at ON public.public_analysis_sessions (purge_at);
CREATE INDEX idx_pas_ip_recent ON public.public_analysis_sessions (ip_hmac, created_at DESC);

CREATE TABLE public.public_analysis_consents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.public_analysis_sessions(id) ON DELETE CASCADE,
  consent_type text NOT NULL,
  granted boolean NOT NULL,
  granted_at timestamptz NOT NULL DEFAULT now(),
  ip_hmac text,
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT public_analysis_consents_type_check CHECK (
    consent_type IN ('camera','delivery','marketing','research')
  ),
  CONSTRAINT public_analysis_consents_unique UNIQUE (session_id, consent_type)
);

REVOKE ALL ON public.public_analysis_consents FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.public_analysis_consents TO service_role;
ALTER TABLE public.public_analysis_consents ENABLE ROW LEVEL SECURITY;
-- Intentionally no policies (service-role only, as above).

CREATE INDEX idx_pac_session ON public.public_analysis_consents (session_id);

CREATE TRIGGER update_public_analysis_sessions_updated_at
  BEFORE UPDATE ON public.public_analysis_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------------------------------------------------------------------
-- Retention: expire stale sessions, drop short-TTL debug payloads and
-- delete anonymous session data after 30 days. Storage objects are removed
-- by the public-analysis-cleanup edge function, which calls this after it
-- has deleted the files it collected.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.purge_public_analysis_expired()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_expired integer;
  v_ai integer;
  v_deleted integer;
BEGIN
  UPDATE public.public_analysis_sessions
     SET status = 'expired', phase = NULL
   WHERE expires_at < now()
     AND status NOT IN ('complete','failed','expired');
  GET DIAGNOSTICS v_expired = ROW_COUNT;

  UPDATE public.public_analysis_sessions
     SET ai_raw = NULL, ai_raw_purge_at = NULL
   WHERE ai_raw IS NOT NULL
     AND ai_raw_purge_at IS NOT NULL
     AND ai_raw_purge_at < now();
  GET DIAGNOSTICS v_ai = ROW_COUNT;

  -- Anonymous sessions only. Once a session becomes a real client report
  -- (client_id set) the existing client-report retention rules apply.
  DELETE FROM public.public_analysis_sessions
   WHERE purge_at < now()
     AND client_id IS NULL;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  RETURN jsonb_build_object('expired', v_expired, 'ai_raw_cleared', v_ai, 'deleted', v_deleted);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.purge_public_analysis_expired() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purge_public_analysis_expired() TO service_role;

-- Rows whose images are past their 24h deadline, for the cleanup function
-- to enumerate and delete from storage before clearing the paths.
CREATE OR REPLACE FUNCTION public.list_public_analysis_image_purge(_limit integer DEFAULT 200)
RETURNS TABLE (id uuid, image_paths jsonb)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.id, s.image_paths
    FROM public.public_analysis_sessions s
   WHERE s.images_purge_at IS NOT NULL
     AND s.images_purge_at < now()
     AND jsonb_array_length(s.image_paths) > 0
   ORDER BY s.images_purge_at
   LIMIT GREATEST(1, LEAST(_limit, 500));
$$;

REVOKE EXECUTE ON FUNCTION public.list_public_analysis_image_purge(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.list_public_analysis_image_purge(integer) TO service_role;