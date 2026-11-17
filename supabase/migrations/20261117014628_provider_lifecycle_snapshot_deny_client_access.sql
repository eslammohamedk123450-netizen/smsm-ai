begin;

-- Defense in depth: even an accidental future table grant cannot expose
-- provider lifecycle snapshots to browser roles. SECURITY DEFINER admin RPCs
-- run as the table owner and remain protected by suly_is_admin().
drop policy if exists provider_lifecycle_snapshots_no_client_access
  on public.ai_provider_lifecycle_snapshots;
create policy provider_lifecycle_snapshots_no_client_access
  on public.ai_provider_lifecycle_snapshots
  for all
  to anon, authenticated
  using (false)
  with check (false);

commit;
