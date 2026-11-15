begin;

-- Pro/Max profiles may race the verified low-latency route first, then use their
-- tier-specific paid fallback only if the free route fails or times out.
insert into public.suly_model_profile_models
  (profile_key, model_id, route_role, priority, enabled, updated_at)
select profile_key, model_id, route_role, priority, true, now()
from (
  select profile_key, model_id, route_role, priority
  from (values
    ('pro', 10, 'chat', 1), ('pro', 2, 'chat', 2),
    ('pro', 10, 'planner', 1), ('pro', 2, 'planner', 2),
    ('pro', 10, 'worker', 1), ('pro', 2, 'worker', 2),
    ('pro', 10, 'reviewer', 1), ('pro', 2, 'reviewer', 2),
    ('pro', 10, 'summarizer', 1), ('pro', 2, 'summarizer', 2),
    ('max', 10, 'chat', 1), ('max', 2, 'chat', 2),
    ('max', 10, 'planner', 1), ('max', 2, 'planner', 2),
    ('max', 10, 'worker', 1), ('max', 2, 'worker', 2),
    ('max', 10, 'reviewer', 1), ('max', 2, 'reviewer', 2),
    ('max', 10, 'summarizer', 1), ('max', 2, 'summarizer', 2)
  ) as seeded(profile_key, model_id, route_role, priority)
) rows
on conflict (profile_key, model_id, route_role)
do update set priority = excluded.priority, enabled = true, updated_at = now();

-- Paid models remain the last fallback in their own tiers.
update public.suly_model_profile_models
set priority = 3, enabled = true, updated_at = now()
where (profile_key = 'pro' and model_id = 2319)
   or (profile_key = 'max' and model_id = 2318);

-- The old worker-only Allam mapping is superseded by the same verified two-model route.
update public.suly_model_profile_models
set enabled = false, updated_at = now()
where profile_key in ('pro', 'max')
  and route_role = 'worker'
  and model_id = 3;

commit;
