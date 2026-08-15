CREATE OR REPLACE FUNCTION public.tg_clients_default_referral_meta()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.referral_meta IS NULL THEN
    NEW.referral_meta := '{}'::jsonb;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.tg_clients_default_referral_meta() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_clients_default_referral_meta ON public.clients;
CREATE TRIGGER trg_clients_default_referral_meta
BEFORE INSERT OR UPDATE ON public.clients
FOR EACH ROW EXECUTE FUNCTION public.tg_clients_default_referral_meta();