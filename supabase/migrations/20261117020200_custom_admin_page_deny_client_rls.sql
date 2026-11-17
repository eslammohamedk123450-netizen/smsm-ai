begin;

-- Custom admin pages are read and written only through SECURITY DEFINER RPCs
-- that enforce suly_is_admin(). Deny all direct browser-role table access.
drop policy if exists suly_admin_custom_pages_no_client_access
  on public.suly_admin_custom_pages;
create policy suly_admin_custom_pages_no_client_access
  on public.suly_admin_custom_pages
  for all to anon, authenticated
  using (false)
  with check (false);

drop policy if exists suly_admin_custom_page_versions_no_client_access
  on public.suly_admin_custom_page_versions;
create policy suly_admin_custom_page_versions_no_client_access
  on public.suly_admin_custom_page_versions
  for all to anon, authenticated
  using (false)
  with check (false);

commit;
