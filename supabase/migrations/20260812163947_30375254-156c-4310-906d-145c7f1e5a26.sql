-- 1. Bucket configuration (8 MB / jpeg+png / private) is enforced from code:
--    the public-analysis-cleanup edge function reconciles the bucket settings
--    on every hourly run, because SQL writes to storage.buckets are rejected.

-- 2. Upload issuance vs verified capture
ALTER TABLE public.public_analysis_sessions
  ADD COLUMN IF NOT EXISTS views_issued jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS capture_method text;

ALTER TABLE public.public_analysis_sessions
  DROP CONSTRAINT IF EXISTS public_analysis_sessions_capture_method_check;
ALTER TABLE public.public_analysis_sessions
  ADD CONSTRAINT public_analysis_sessions_capture_method_check
  CHECK (capture_method IS NULL OR capture_method IN ('camera','upload'));

-- 3. Consent semantics: image_processing is the required consent for both
--    camera capture and upload fallback.
ALTER TABLE public.public_analysis_consents
  DROP CONSTRAINT IF EXISTS public_analysis_consents_type_check;
ALTER TABLE public.public_analysis_consents
  ADD CONSTRAINT public_analysis_consents_type_check
  CHECK (consent_type IN ('image_processing','camera','upload','delivery','marketing','research'));

-- 4. Failure-safe retention: never delete a session that still owns objects.
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
  v_blocked integer;
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

  -- Sessions still holding storage objects are skipped; the cleanup worker
  -- deletes the objects and clears image_paths first, then the row goes on
  -- the next run. This makes orphaned images impossible.
  SELECT count(*) INTO v_blocked
    FROM public.public_analysis_sessions
   WHERE purge_at < now()
     AND client_id IS NULL
     AND jsonb_array_length(coalesce(image_paths, '[]'::jsonb)) > 0;

  DELETE FROM public.public_analysis_sessions
   WHERE purge_at < now()
     AND client_id IS NULL
     AND jsonb_array_length(coalesce(image_paths, '[]'::jsonb)) = 0;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  RETURN jsonb_build_object(
    'expired', v_expired,
    'ai_raw_cleared', v_ai,
    'deleted', v_deleted,
    'deletion_blocked_by_images', v_blocked
  );
END;
$$;

REVOKE ALL ON FUNCTION public.purge_public_analysis_expired() FROM PUBLIC, anon, authenticated;

-- 5. Images due for purge should also include rows whose session is past
--    its overall purge deadline (so storage is cleared before row deletion).
DROP FUNCTION IF EXISTS public.list_public_analysis_image_purge(integer);
CREATE FUNCTION public.list_public_analysis_image_purge(_limit integer DEFAULT 200)
RETURNS TABLE (id uuid, image_paths text[])
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.id,
         ARRAY(SELECT jsonb_array_elements_text(s.image_paths))::text[]
    FROM public.public_analysis_sessions s
   WHERE jsonb_array_length(coalesce(s.image_paths, '[]'::jsonb)) > 0
     AND (
       (s.images_purge_at IS NOT NULL AND s.images_purge_at < now())
       OR s.purge_at < now()
     )
   ORDER BY s.created_at
   LIMIT greatest(1, least(coalesce(_limit, 200), 500));
$$;

REVOKE ALL ON FUNCTION public.list_public_analysis_image_purge(integer) FROM PUBLIC, anon, authenticated;

-- 6. Hourly storage cleanup invocation (uses the existing vault cron secret).
SELECT cron.unschedule('public-analysis-storage-cleanup')
 WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'public-analysis-storage-cleanup');

SELECT cron.schedule(
  'public-analysis-storage-cleanup',
  '37 * * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://fboyigzmwbzqhufjsauc.supabase.co/functions/v1/public-analysis-cleanup',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'x-cron-secret',(SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='cron_secret')
    ),
    body := '{}'::jsonb
  );
  $cron$
);