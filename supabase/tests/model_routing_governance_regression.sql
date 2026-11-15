-- Read-only regression checks for model routing governance.
do $$
begin
  if exists (
    select 1 from public.ai_route_model_assignments
    where enabled group by route_role having count(*) > 2 or count(*) < 1
  ) then raise exception 'global route must contain one or two models'; end if;

  if exists (
    select required.route_role
    from (values ('chat'), ('planner'), ('worker'), ('reviewer'), ('summarizer')) as required(route_role)
    left join public.ai_route_model_assignments a
      on a.route_role = required.route_role and a.enabled
    group by required.route_role
    having count(a.model_id) = 0
  ) then raise exception 'a required global model route is empty'; end if;

  if exists (
    select profiles.profile_key, roles.route_role
    from (values ('lite'), ('pro'), ('max')) as profiles(profile_key)
    cross join (values ('chat'), ('planner'), ('worker'), ('reviewer'), ('summarizer')) as roles(route_role)
    left join public.suly_model_profile_models a
      on a.profile_key = profiles.profile_key and a.route_role = roles.route_role and a.enabled
    left join public.ai_models m on m.id = a.model_id and m.enabled and m.routing_group = 'free_race'
    group by required.profile_key, required.route_role
    having count(distinct m.id) < 2
  ) then raise exception 'a subscription profile is missing a fast-route fallback'; end if;

  if exists (
    select 1 from public.ai_route_model_assignments a
    join public.ai_models m on m.id=a.model_id
    join public.ai_providers p on p.id=m.provider_id
    where a.enabled and (not m.enabled or not p.enabled or m.routing_group <> 'free_race')
  ) then raise exception 'route includes an unavailable model/provider'; end if;

  if has_table_privilege('authenticated','public.ai_route_model_assignments','INSERT')
     or has_table_privilege('authenticated','public.ai_route_model_assignments','UPDATE')
     or has_table_privilege('authenticated','public.ai_route_model_assignments','DELETE')
  then raise exception 'direct authenticated route writes remain available'; end if;

  if has_function_privilege('anon','public.suly_admin_save_route_models(text,integer[])','execute')
     or has_function_privilege('anon','public.suly_admin_set_provider_lifecycle(integer,boolean,boolean)','execute')
  then raise exception 'anonymous access to admin routing functions remains available'; end if;

  if exists (
    select 1 from public.suly_media_generation_models m
    join public.ai_providers p on p.id=m.provider_id
    where m.is_active and not p.enabled
  ) then raise exception 'active media model belongs to disabled provider'; end if;

  if not exists (
    select 1 from public.ai_router_settings
    where id=1 and free_race_timeout_ms=5000 and paid_fallback_timeout_ms=10000
      and preflight_probe_enabled=false and max_parallel_free_models=3
  ) then raise exception 'router latency settings do not match approved balanced profile'; end if;
end $$;

select 'model routing governance regression passed' as result;
