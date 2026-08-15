CREATE OR REPLACE FUNCTION public.stamp_xcape_origin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  uid uuid := auth.uid();
  is_admin boolean;
  org uuid;
  r text;
BEGIN
  IF uid IS NULL THEN RETURN NEW; END IF;
  is_admin := public.has_role(uid, 'admin');

  -- Only an admin may record a row on behalf of another operator; everyone
  -- else is pinned to their own identity regardless of what was submitted.
  IF NEW.origin_user_id IS NULL
     OR (NEW.origin_user_id <> uid AND NOT is_admin) THEN
    NEW.origin_user_id := uid;
  END IF;

  -- Role and organisation are always derived server-side for non-admins so a
  -- browser cannot claim a role or partner org it does not hold.
  IF NEW.origin_role IS NULL OR NOT is_admin THEN
    SELECT ur.role::text INTO r FROM public.user_roles ur
    WHERE ur.user_id = NEW.origin_user_id
    ORDER BY CASE ur.role::text
      WHEN 'admin' THEN 1 WHEN 'cdp' THEN 2 WHEN 'affiliate' THEN 3 ELSE 4 END
    LIMIT 1;
    NEW.origin_role := r;
  END IF;

  IF NEW.origin_org_id IS NULL OR NOT is_admin THEN
    org := public.primary_org_id(NEW.origin_user_id);
    NEW.origin_org_id := COALESCE(org, public.xcape_root_org_id());
  END IF;

  RETURN NEW;
END;
$function$;