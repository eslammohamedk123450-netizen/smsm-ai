begin;

-- Add a known, measured text-capable backup to the chat route.
insert into public.ai_route_model_assignments (route_role, model_id, priority, enabled, updated_at)
values ('chat', 3, 2, true, now())
on conflict (route_role, model_id)
do update set enabled = true, priority = 2, updated_at = now();

-- A route is exactly its top two eligible choices. Every other saved row is retained
-- for audit/recovery but disabled, including stale rows excluded from the eligible CTE.
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
where a.enabled = true
  and not exists (select 1 from eligible e where e.id = a.id and e.route_rank <= 2);

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
where a.enabled = true
  and not exists (select 1 from eligible e where e.id = a.id and e.route_rank <= 2);

commit;
