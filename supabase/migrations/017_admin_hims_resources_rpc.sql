-- Admin HIMS resource listing. Resource URLs only; file bytes remain in external storage.
begin;

create or replace function public.suly_admin_list_feature_resources(p_feature_key text default 'hims')
returns table (
  id uuid,
  feature_key text,
  title text,
  url text,
  kind text,
  description text,
  is_active boolean,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public, auth
as $$
begin
  if not public.suly_is_admin() then
    raise exception 'administrator privileges required' using errcode = '42501';
  end if;
  return query
    select r.id, r.feature_key, r.title, r.url, r.kind, r.description, r.is_active, r.created_at
    from public.suly_feature_resources as r
    where r.feature_key = lower(trim(coalesce(p_feature_key, 'hims')))
    order by r.created_at desc
    limit 200;
end;
$$;

revoke all on function public.suly_admin_list_feature_resources(text) from public, anon;
grant execute on function public.suly_admin_list_feature_resources(text) to authenticated;

commit;
