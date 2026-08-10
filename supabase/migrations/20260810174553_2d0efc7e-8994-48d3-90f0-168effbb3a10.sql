-- Admin-only storage policies for the private xcape-admin-mockups bucket.
-- The bucket itself was created private (public = false) via the storage tool.
-- No anon policy; no broad authenticated policy; every policy is admin role-scoped.

create policy "Admins can read mockup assets"
on storage.objects
for select
to authenticated
using (bucket_id = 'xcape-admin-mockups' and public.has_role(auth.uid(), 'admin'));

create policy "Admins can upload mockup assets"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'xcape-admin-mockups' and public.has_role(auth.uid(), 'admin'));

create policy "Admins can delete mockup assets"
on storage.objects
for delete
to authenticated
using (bucket_id = 'xcape-admin-mockups' and public.has_role(auth.uid(), 'admin'));