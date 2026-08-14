CREATE OR REPLACE FUNCTION public.xcape_reuse_client(_client_id uuid, _phone text)
RETURNS public.clients
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_row public.clients;
  v_key text := public.xcape_normalise_phone(_phone);
BEGIN
  IF auth.uid() IS NULL OR length(v_key) < 7 THEN
    RAISE EXCEPTION 'A valid phone number is required to continue with an existing client';
  END IF;

  SELECT * INTO v_row
  FROM public.clients c
  WHERE c.id = _client_id
    AND c.phone IS NOT NULL
    AND public.xcape_normalise_phone(c.phone) = v_key;

  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'No matching client for that phone number';
  END IF;

  RETURN v_row;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.xcape_reuse_client(uuid, text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.xcape_reuse_client(uuid, text) TO authenticated;