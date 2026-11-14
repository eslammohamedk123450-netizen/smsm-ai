begin;

create table if not exists public.ai_route_model_assignments (
  id uuid primary key default gen_random_uuid(),
  route_role text not null check (route_role in ('chat','planner','worker','reviewer','summarizer')),
  model_id integer not null references public.ai_models(id) on delete cascade,
  priority integer not null check (priority >= 1 and priority <= 500),
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (route_role, model_id)
);

create index if not exists ai_route_model_assignments_role_priority_idx
  on public.ai_route_model_assignments (route_role, priority, id);

alter table public.ai_route_model_assignments enable row level security;
drop policy if exists ai_route_model_assignments_admin_read on public.ai_route_model_assignments;
create policy ai_route_model_assignments_admin_read
  on public.ai_route_model_assignments for select to authenticated
  using (public.suly_is_admin());
drop policy if exists ai_route_model_assignments_admin_write on public.ai_route_model_assignments;
create policy ai_route_model_assignments_admin_write
  on public.ai_route_model_assignments for all to authenticated
  using (public.suly_is_admin())
  with check (public.suly_is_admin());
revoke all on table public.ai_route_model_assignments from anon;
grant select, insert, update, delete on public.ai_route_model_assignments to authenticated;
grant all on public.ai_route_model_assignments to service_role;

-- Seed only empty routes. Existing explicit model settings remain untouched.
insert into public.ai_route_model_assignments (route_role, model_id, priority)
select 'chat', m.id, row_number() over (order by m.priority desc, m.id)
from public.ai_models m
where m.enabled = true and m.routing_group = 'free_race'
  and not exists (select 1 from public.ai_route_model_assignments a where a.route_role = 'chat');

insert into public.ai_route_model_assignments (route_role, model_id, priority)
select 'planner', m.id, row_number() over (order by m.priority desc, m.id)
from public.ai_models m
where m.enabled = true
  and m.routing_group in ('free_race', 'paid_fallback')
  and ('general' = any(m.task_roles) or 'planner' = any(m.task_roles))
  and not exists (select 1 from public.ai_route_model_assignments a where a.route_role = 'planner');

insert into public.ai_route_model_assignments (route_role, model_id, priority)
select 'worker', m.id, row_number() over (order by m.priority desc, m.id)
from public.ai_models m
where m.enabled = true
  and m.routing_group in ('free_race', 'paid_fallback')
  and ('general' = any(m.task_roles) or 'worker' = any(m.task_roles) or 'executor' = any(m.task_roles))
  and not exists (select 1 from public.ai_route_model_assignments a where a.route_role = 'worker');

insert into public.ai_route_model_assignments (route_role, model_id, priority)
select 'reviewer', m.id, row_number() over (order by m.priority desc, m.id)
from public.ai_models m
where m.enabled = true
  and m.routing_group in ('free_race', 'paid_fallback')
  and ('general' = any(m.task_roles) or 'reviewer' = any(m.task_roles))
  and not exists (select 1 from public.ai_route_model_assignments a where a.route_role = 'reviewer');

insert into public.ai_route_model_assignments (route_role, model_id, priority)
select 'summarizer', m.id, row_number() over (order by m.priority desc, m.id)
from public.ai_models m
where m.enabled = true
  and m.routing_group in ('free_race', 'paid_fallback')
  and ('general' = any(m.task_roles) or 'summarizer' = any(m.task_roles))
  and not exists (select 1 from public.ai_route_model_assignments a where a.route_role = 'summarizer');

commit;
