create or replace function public.suly_admin_save_route_models(
  p_route_role text,
  p_model_ids integer[]
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_ids integer[] := coalesce(p_model_ids, array[]::integer[]);
  v_distinct_count integer;
begin
  if not public.suly_is_admin() then
    raise exception 'administrator privileges required' using errcode = '42501';
  end if;
  if p_route_role is null or p_route_role not in ('chat', 'planner', 'worker', 'reviewer', 'summarizer') then
    raise exception 'unsupported route role' using errcode = '22023';
  end if;
  if cardinality(v_ids) < 1 or cardinality(v_ids) > 2 then
    raise exception 'each route requires one primary model and may have one backup' using errcode = '22023';
  end if;

  select count(distinct id) into v_distinct_count from unnest(v_ids) as ids(id);
  if v_distinct_count <> cardinality(v_ids) then
    raise exception 'duplicate model ids are not allowed' using errcode = '22023';
  end if;

  if exists (
    select 1
    from unnest(v_ids) requested(id)
    left join public.ai_models m on m.id = requested.id
    left join public.ai_providers p on p.id = m.provider_id
    left join public.ai_model_health h on h.model_id = m.id
    where m.id is null
       or m.enabled is not true
       or p.enabled is not true
       or m.routing_group <> 'free_race'
       or coalesce(h.auto_restricted, false) is true
       or not (
         coalesce(cardinality(m.task_roles), 0) = 0
         or 'general' = any(m.task_roles)
         or (p_route_role = 'chat' and 'chat' = any(m.task_roles))
         or (p_route_role = 'planner' and 'planner' = any(m.task_roles))
         or (p_route_role = 'worker' and ('worker' = any(m.task_roles) or 'executor' = any(m.task_roles)))
         or (p_route_role = 'reviewer' and 'reviewer' = any(m.task_roles))
         or (p_route_role = 'summarizer' and 'summarizer' = any(m.task_roles))
       )
       or (
         p_route_role = 'chat'
         and (
           not coalesce((m.capabilities_json::jsonb ->> 'chat')::boolean, true)
           or m.model_identifier ~* '(embed|embedding|whisper|tts|speech|audio|image|imagen|dall-e|flux|stable-diffusion|kling|seedance|seedream|ideogram|nano-banana|minimax|lyria|transcrib|robotics|deep-research|computer-use|guard|moderation|rerank)'
         )
       )
  ) then
    raise exception 'one or more models are disabled, unavailable, restricted, or not allowed for this role' using errcode = '23514';
  end if;

  delete from public.ai_route_model_assignments where route_role = p_route_role;
  insert into public.ai_route_model_assignments (route_role, model_id, priority, enabled, updated_at)
  select p_route_role, requested.id, requested.ordinality::integer, true, now()
  from unnest(v_ids) with ordinality as requested(id, ordinality);

  return jsonb_build_object('success', true, 'route_role', p_route_role, 'selected_count', cardinality(v_ids));
end;
$$;

revoke all on function public.suly_admin_save_route_models(text, integer[]) from public, anon;
grant execute on function public.suly_admin_save_route_models(text, integer[]) to authenticated;
