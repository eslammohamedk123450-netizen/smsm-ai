begin;

do $$
declare
  v_verified_count integer;
begin
  select count(*)
    into v_verified_count
  from public.ai_models m
  join public.ai_providers p on p.id = m.provider_id
  left join public.ai_model_health h on h.model_id = m.id
  where m.id in (317, 478)
    and m.enabled is true
    and p.enabled is true
    and m.routing_group = 'free_race'
    and coalesce(h.auto_restricted, false) is false
    and coalesce((m.capabilities_json::jsonb ->> 'chat')::boolean, true) is true
    and exists (
      select 1
      from public.ai_model_probe_logs latest
      where latest.model_id = m.id
        and latest.status = 'success'
        and not exists (
          select 1
          from public.ai_model_probe_logs newer
          where newer.model_id = latest.model_id
            and newer.checked_at > latest.checked_at
        )
    );

  if v_verified_count <> 2 then
    raise exception 'Expected two enabled, healthy, recently successful Gemini text models; found %', v_verified_count;
  end if;
end $$;

-- Preserve the existing Groq route entries and append verified Gemini models
-- as cross-provider fallbacks for every central Agent role.
insert into public.ai_route_model_assignments
  (route_role, model_id, priority, enabled, updated_at)
select roles.route_role, models.model_id, models.priority, true, now()
from (values
  ('chat'::text), ('planner'::text), ('worker'::text),
  ('reviewer'::text), ('summarizer'::text)
) as roles(route_role)
cross join (values
  (317, 3), -- Google Gemini primary key: Gemma 4 26B, verified text probe
  (478, 4)  -- Google Gemini secondary key: Gemma 4 26B, verified text probe
) as models(model_id, priority)
on conflict (route_role, model_id)
do update set
  priority = excluded.priority,
  enabled = true,
  updated_at = now();

-- Give the four-model cross-provider route a bounded eight-second failover window.
update public.ai_router_settings
set free_race_timeout_ms = 8000,
    max_parallel_free_models = 4,
    updated_at = now()
where id = 1;

commit;
