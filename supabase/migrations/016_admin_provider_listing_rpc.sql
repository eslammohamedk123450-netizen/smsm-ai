-- Read-only admin RPC for the provider catalog.
-- Avoids relying on PostgREST view privileges while keeping provider secrets hidden.
begin;

create or replace function public.suly_admin_list_providers()
returns table (
  id integer,
  name varchar,
  provider_type varchar,
  base_url varchar,
  enabled boolean,
  priority integer,
  last_test_status varchar,
  last_tested_at timestamptz
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
    select
      p.id,
      p.name,
      p.provider_type,
      p.base_url,
      p.enabled,
      p.priority,
      p.last_test_status,
      p.last_tested_at
    from public.ai_providers as p
    order by p.priority asc, p.id asc
    limit 100;
end;
$$;

revoke all on function public.suly_admin_list_providers() from public, anon;
grant execute on function public.suly_admin_list_providers() to authenticated;

commit;
