begin;

-- Align chat route with the same two verified models assigned to the Lite profile.
insert into public.ai_route_model_assignments (route_role, model_id, priority, enabled, updated_at)
values ('chat', 2, 2, true, now())
on conflict (route_role, model_id)
do update set enabled = true, priority = 2, updated_at = now();

update public.ai_route_model_assignments
set enabled = false, updated_at = now()
where route_role = 'chat' and model_id <> 10 and model_id <> 2 and enabled = true;

-- Remove legacy direct model overrides: the central role routes are authoritative.
update public.ai_router_settings
set agent_planner_model_id = null,
    agent_summarizer_model_id = null,
    gmail_task_model_id = null,
    updated_at = now()
where id = 1;

-- Quarantine active catalog entries with no successful health checks unless they
-- remain explicitly assigned to a Pro/Max profile. No model rows or usage history
-- are deleted; admins can re-enable a model after a successful manual test.
update public.ai_models m
set enabled = false,
    fallback_eligible = false,
    routing_group = 'disabled',
    updated_at = now()
where m.enabled = true
  and m.id not in (2, 3, 10, 320, 326, 327, 331, 2318, 2319)
  and not exists (
    select 1 from public.ai_route_model_assignments a
    where a.model_id = m.id and a.enabled = true
  )
  and not exists (
    select 1 from public.suly_model_profile_models a
    where a.model_id = m.id and a.enabled = true
  );

commit;
