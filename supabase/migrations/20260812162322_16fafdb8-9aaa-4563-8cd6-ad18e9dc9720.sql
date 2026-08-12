DO $$
BEGIN
  PERFORM cron.unschedule('purge-public-analysis');
EXCEPTION WHEN OTHERS THEN
  NULL;
END$$;

DO $$
BEGIN
  PERFORM cron.schedule(
    'purge-public-analysis',
    '17 * * * *',
    $cron$ SELECT public.purge_public_analysis_expired(); $cron$
  );
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'purge-public-analysis: cron schedule failed: %', SQLERRM;
END$$;