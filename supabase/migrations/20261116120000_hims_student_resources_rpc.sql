-- Authenticated HIMS students may list only their own feature's active resources.
-- No client role receives direct SELECT on suly_feature_resources.
create or replace function public.suly_my_feature_resources(
  p_limit integer default 100,
  p_offset integer default 0
)
returns table (
  id uuid,
  title text,
  url text,
  media_asset_id uuid,
  kind text,
  description text,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  v_uid uuid := auth.uid();
  v_limit integer := least(greatest(coalesce(p_limit, 100), 1), 200);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
begin
  if v_uid is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.suly_profiles p
    join public.suly_feature_flags f on f.feature_key = 'hims' and f.is_active
    where p.id = v_uid and p.hims_activated is true
  ) then
    return;
  end if;

  return query
    select r.id, r.title, r.url, r.media_asset_id, r.kind, r.description, r.created_at
    from public.suly_feature_resources r
    where r.feature_key = 'hims' and r.is_active
    order by r.created_at desc, r.id
    limit v_limit offset v_offset;
end;
$$;

revoke all on function public.suly_my_feature_resources(integer, integer) from public, anon;
grant execute on function public.suly_my_feature_resources(integer, integer) to authenticated;

comment on function public.suly_my_feature_resources(integer, integer)
  is 'Returns active HIMS resources only to the authenticated user whose HIMS activation is enabled. Private media URLs are resolved separately through media-gateway.';
