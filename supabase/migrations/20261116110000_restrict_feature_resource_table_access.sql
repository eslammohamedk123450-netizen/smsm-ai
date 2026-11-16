-- Feature resources can contain private HIMS links and must never be enumerable
-- through the public Data API. Edge Functions use service_role and admins use
-- guarded SECURITY DEFINER RPCs; no mobile client needs direct table access.
begin;

revoke all on table public.suly_feature_resources from anon, authenticated;

do $$
begin
  if has_table_privilege('anon', 'public.suly_feature_resources', 'SELECT')
     or has_table_privilege('authenticated', 'public.suly_feature_resources', 'SELECT') then
    raise exception 'feature resource table is still directly readable by client roles';
  end if;
  if not has_table_privilege('service_role', 'public.suly_feature_resources', 'SELECT') then
    raise exception 'service_role lost required feature resource read access';
  end if;
end;
$$;

comment on table public.suly_feature_resources is
  'Private feature resource registry. Client roles must use authenticated feature-scoped server APIs; direct Data API access is revoked.';

commit;
