-- Explicit deny-by-default for the xcape-public-demo bucket.
-- storage.objects already has RLS enabled; adding no permissive policy for
-- this bucket means anon/authenticated cannot list, read, insert, update or
-- delete any object in it. Uploads happen only via short-lived, path-scoped
-- signed upload tokens minted server-side with the service role.
--
-- Defensive: ensure no pre-existing broad policy accidentally covers it.
DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT policyname
      FROM pg_policies
     WHERE schemaname = 'storage'
       AND tablename = 'objects'
       AND (qual ILIKE '%xcape-public-demo%' OR with_check ILIKE '%xcape-public-demo%')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', pol.policyname);
  END LOOP;
END$$;