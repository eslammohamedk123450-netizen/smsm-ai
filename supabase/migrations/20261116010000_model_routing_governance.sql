begin;

-- Provider disable is a hard freeze: no route/profile can keep invoking its models.
create or replace function public.suly_admin_set_provider_lifecycle(
  p_provider_id integer,
  p_enabled boolean,
  p_hide_models boolean default true
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
begin
  if not public.suly_is_admin() then
    raise exception 'administrator privileges required' using errcode = '42501';
  end if;

  update public.ai_providers
  set enabled = coalesce(p_enabled, false), updated_at = now()
  where id = p_provider_id;

  if not found then
    raise exception 'provider not found' using errcode = 'P0002';
  end if;

  if not coalesce(p_enabled, false) then
    update public.ai_route_model_assignments a
    set enabled = false, updated_at = now()
    from public.ai_models m
    where a.model_id = m.id and m.provider_id = p_provider_id;

    update public.suly_model_profile_models a
    set enabled = false, updated_at = now()
    from public.ai_models m
    where a.model_id = m.id and m.provider_id = p_provider_id;

    update public.ai_router_settings s
    set gmail_task_model_id = case when gmail_task_model_id in
          (select id from public.ai_models where provider_id = p_provider_id) then null else gmail_task_model_id end,
        agent_planner_model_id = case when agent_planner_model_id in
          (select id from public.ai_models where provider_id = p_provider_id) then null else agent_planner_model_id end,
        agent_summarizer_model_id = case when agent_summarizer_model_id in
          (select id from public.ai_models where provider_id = p_provider_id) then null else agent_summarizer_model_id end,
        updated_at = now()
    where id = 1;
  end if;
end;
$$;

-- Keep only the two best currently usable candidates per global route.
-- Disabled providers/models and non-chat media/speech catalog entries are never routable.
with eligible as (
  select a.id,
         row_number() over (
           partition by a.route_role
           order by coalesce(h.successful_attempts, 0) desc,
                    h.average_latency_ms asc nulls last,
                    a.priority asc,
                    m.id asc
         ) as route_rank
  from public.ai_route_model_assignments a
  join public.ai_models m on m.id = a.model_id
  join public.ai_providers p on p.id = m.provider_id
  left join public.ai_model_health h on h.model_id = m.id
  where a.enabled = true
    and m.enabled = true
    and p.enabled = true
    and m.routing_group = 'free_race'
    and coalesce(h.auto_restricted, false) = false
    and (
      coalesce(cardinality(m.task_roles), 0) = 0
      or 'general' = any(m.task_roles)
      or (a.route_role = 'planner' and 'planner' = any(m.task_roles))
      or (a.route_role = 'worker' and ('worker' = any(m.task_roles) or 'executor' = any(m.task_roles)))
      or (a.route_role = 'reviewer' and 'reviewer' = any(m.task_roles))
      or (a.route_role = 'summarizer' and 'summarizer' = any(m.task_roles))
    )
    and (
      a.route_role <> 'chat'
      or (
        coalesce((m.capabilities_json::jsonb ->> 'chat')::boolean, true)
        and m.model_identifier !~* '(embed|embedding|whisper|tts|speech|audio|image|imagen|dall-e|flux|stable-diffusion|kling|seedance|seedream|ideogram|nano-banana|minimax|lyria|transcrib|robotics|deep-research|computer-use|guard|moderation|rerank)'
      )
    )
)
update public.ai_route_model_assignments a
set enabled = false, updated_at = now()
from eligible e
where a.id = e.id and e.route_rank > 2;

-- Apply the same two-model cap inside each subscription profile and role.
with eligible as (
  select a.id,
         row_number() over (
           partition by a.profile_key, a.route_role
           order by coalesce(h.successful_attempts, 0) desc,
                    h.average_latency_ms asc nulls last,
                    a.priority asc,
                    m.id asc
         ) as route_rank
  from public.suly_model_profile_models a
  join public.ai_models m on m.id = a.model_id
  join public.ai_providers p on p.id = m.provider_id
  left join public.ai_model_health h on h.model_id = m.id
  where a.enabled = true
    and m.enabled = true
    and p.enabled = true
    and coalesce(h.auto_restricted, false) = false
    and (
      coalesce(cardinality(m.task_roles), 0) = 0
      or 'general' = any(m.task_roles)
      or (a.route_role = 'planner' and 'planner' = any(m.task_roles))
      or (a.route_role = 'worker' and ('worker' = any(m.task_roles) or 'executor' = any(m.task_roles)))
      or (a.route_role = 'reviewer' and 'reviewer' = any(m.task_roles))
      or (a.route_role = 'summarizer' and 'summarizer' = any(m.task_roles))
    )
    and (
      a.route_role <> 'chat'
      or (
        coalesce((m.capabilities_json::jsonb ->> 'chat')::boolean, true)
        and m.model_identifier !~* '(embed|embedding|whisper|tts|speech|audio|image|imagen|dall-e|flux|stable-diffusion|kling|seedance|seedream|ideogram|nano-banana|minimax|lyria|transcrib|robotics|deep-research|computer-use|guard|moderation|rerank)'
      )
    )
)
update public.suly_model_profile_models a
set enabled = false, updated_at = now()
from eligible e
where a.id = e.id and e.route_rank > 2;

commit;
