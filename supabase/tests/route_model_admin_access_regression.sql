-- Rollback-only verification of the central Agent route admin RPC.
-- No production route assignments are retained by this test.
begin;

select set_config(
  'request.jwt.claim.sub',
  (select user_id::text from public.suly_admins order by user_id limit 1),
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config(
  'suly.test.route_model_ids',
  (
    select string_agg(id::text, ',')
    from (
      select m.id
      from public.ai_models m
      join public.ai_providers p on p.id = m.provider_id
      left join public.ai_model_health h on h.model_id = m.id
      where m.enabled is true
        and p.enabled is true
        and m.routing_group = 'free_race'
        and not coalesce(h.auto_restricted, false)
        and (coalesce(cardinality(m.task_roles), 0) = 0 or 'general' = any(m.task_roles))
      order by m.priority desc, m.id
      limit 2
    ) eligible
  ),
  true
);
set local role authenticated;

do $admin$
declare
  v_ids integer[] := string_to_array(current_setting('suly.test.route_model_ids'), ',')::integer[];
  v_role text;
  v_result jsonb;
  v_count integer;
begin
  if not public.suly_is_admin() then
    raise exception 'active administrator fixture was not recognized';
  end if;

  if coalesce(cardinality(v_ids), 0) <> 2 then
    raise exception 'two enabled, unrestricted general-purpose route fixtures are required';
  end if;

  foreach v_role in array array['chat','planner','worker','reviewer','summarizer'] loop
    v_result := public.suly_admin_save_route_models(v_role, v_ids);
    if coalesce((v_result->>'success')::boolean, false) is not true then
      raise exception 'administrator could not save route %: %', v_role, v_result;
    end if;

    select count(*) into v_count
    from public.suly_admin_list_unified_route_assignments()
    where route_role = v_role and enabled;

    if v_count <> 2 then
      raise exception 'saved route % did not persist both fixture models inside test transaction', v_role;
    end if;
  end loop;
end;
$admin$;

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', true);
do $non_admin$
begin
  if public.suly_is_admin() then
    raise exception 'non-admin fixture was unexpectedly recognized as administrator';
  end if;

  begin
    perform public.suly_admin_save_route_models('planner', array[2,3]::integer[]);
    raise exception 'non-admin was allowed to modify central Agent route assignments';
  exception
    when insufficient_privilege then null;
  end;
end;
$non_admin$;

rollback;
