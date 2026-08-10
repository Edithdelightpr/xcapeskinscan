CREATE OR REPLACE FUNCTION public.verify_cron_secret(candidate text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  RETURN candidate IS NOT NULL
     AND length(candidate) > 0
     AND candidate = (
       SELECT decrypted_secret
       FROM vault.decrypted_secrets
       WHERE name = 'cron_secret'
     );
END;
$function$;

REVOKE ALL ON FUNCTION public.verify_cron_secret(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.verify_cron_secret(text) FROM anon;
REVOKE ALL ON FUNCTION public.verify_cron_secret(text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.verify_cron_secret(text) TO service_role;