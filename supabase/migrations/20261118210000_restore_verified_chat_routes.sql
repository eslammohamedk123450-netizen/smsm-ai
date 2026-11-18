begin;

do $$
declare
  v_verified_count integer;
begin
  -- Only route models that are already enabled, healthy, provider-tested,
  -- recently probed successfully, and explicitly support general chat.
  -- This migration does not enable providers or model records.
  select count(distinct m.id)
    into v_verified_count
  from public.ai_models m
  join public.ai_providers p on p.id = m.provider_id
  join public.ai_model_capability_evidence e
    on e.model_id = m.id
   and e.capability_key = 'text'
   and e.provider_test_status = 'passed'
   and e.suly_test_status <> 'failed'
  left join public.ai_model_health h on h.model_id = m.id
  where m.id in (2306, 2311)
    and m.enabled is true
    and p.enabled is true
    and m.routing_group = 'free_race'
    and coalesce(h.auto_restricted, false) is false
    and coalesce(h.consecutive_failures, 0) < 3
    and coalesce((m.capabilities_json::jsonb ->> 'chat')::boolean, true) is true
    and coalesce(m.task_roles, array['general']::text[]) && array['general', 'chat']::text[]
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
    raise exception
      'Expected two enabled, provider-tested, healthy chat models with a latest successful probe; found %',
      v_verified_count;
  end if;
end $$;

-- The live chat allowlist previously contained only a disabled model and an
-- auto-restricted model. Restore two verified, enabled models for chat only.
-- Planner/worker/reviewer/summarizer routes are intentionally unchanged.
insert into public.ai_route_model_assignments
  (route_role, model_id, priority, enabled, updated_at)
values
  ('chat', 2306, 1, true, now()),
  ('chat', 2311, 2, true, now())
on conflict (route_role, model_id)
do update set
  priority = excluded.priority,
  enabled = true,
  updated_at = now();

commit;
