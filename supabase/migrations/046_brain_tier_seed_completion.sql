begin;

-- The initial catalog can legitimately classify every currently enabled legacy
-- model as cheap. Keep the cost labels editable, but still seed all brain roles
-- from distinct linked models so the new orchestration path is usable now.
insert into public.brain_tiers(tier_name, priority, model_id, max_tokens_per_task)
select 'router', 2, m.id, 768
from public.models m
where m.is_active and m.legacy_ai_model_id is not null
  and not exists (select 1 from public.brain_tiers t where t.tier_name = 'router' and t.priority = 2)
order by m.created_at, m.id
limit 1;

insert into public.brain_tiers(tier_name, priority, model_id, max_tokens_per_task)
select 'worker', 2, m.id, 4096
from public.models m
where m.is_active and m.legacy_ai_model_id is not null
  and not exists (select 1 from public.brain_tiers t where t.tier_name = 'worker' and t.priority = 2)
order by m.created_at, m.id
limit 1;

insert into public.brain_tiers(tier_name, priority, model_id, max_tokens_per_task)
select 'planner', 1, m.id, 4096
from public.models m
where m.is_active and m.legacy_ai_model_id is not null
  and not exists (select 1 from public.brain_tiers t where t.tier_name = 'planner' and t.priority = 1)
order by m.created_at desc, m.id
limit 1;

insert into public.brain_tiers(tier_name, priority, model_id, max_tokens_per_task)
select 'merger', 1, m.id, 4096
from public.models m
where m.is_active and m.legacy_ai_model_id is not null
  and not exists (select 1 from public.brain_tiers t where t.tier_name = 'merger' and t.priority = 1)
order by m.created_at desc, m.id
limit 1;

commit;
