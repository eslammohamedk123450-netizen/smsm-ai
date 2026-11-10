begin;

create table if not exists public.models (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 160),
  provider text not null check (char_length(btrim(provider)) between 1 and 120),
  icon_url text,
  cost_level text not null default 'medium' check (cost_level in ('cheap', 'medium', 'expensive')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  legacy_ai_model_id integer unique references public.ai_models(id) on delete set null
);

create table if not exists public.capabilities (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  label text not null,
  constraint capabilities_key_check check (key in ('text','coding','image','video','vision','audio','reasoning','web_search'))
);

create table if not exists public.model_capabilities (
  model_id uuid not null references public.models(id) on delete cascade,
  capability_key text not null references public.capabilities(key) on delete cascade,
  primary key (model_id, capability_key)
);

create table if not exists public.brain_tiers (
  id uuid primary key default gen_random_uuid(),
  tier_name text not null check (tier_name in ('router','worker','planner','merger')),
  priority smallint not null check (priority between 1 and 3),
  model_id uuid not null references public.models(id) on delete restrict,
  max_tokens_per_task integer not null default 1024 check (max_tokens_per_task between 128 and 120000),
  is_active boolean not null default true,
  unique (tier_name, priority),
  unique (tier_name, model_id)
);

create table if not exists public.plans (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (name in ('free','pro','max')),
  starting_brain_tier text not null default 'worker' check (starting_brain_tier in ('router','worker','planner','merger')),
  daily_tasks_limit integer not null check (daily_tasks_limit between 1 and 100000),
  daily_tokens_limit integer not null check (daily_tokens_limit between 128 and 100000000),
  created_at timestamptz not null default now()
);

create table if not exists public.brain_usage_daily (
  user_id uuid not null references auth.users(id) on delete cascade,
  usage_date date not null default current_date,
  tasks_used integer not null default 0 check (tasks_used >= 0),
  tokens_used bigint not null default 0 check (tokens_used >= 0),
  tokens_reserved bigint not null default 0 check (tokens_reserved >= 0),
  primary key (user_id, usage_date)
);

create table if not exists public.brain_usage_events (
  task_id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  usage_date date not null,
  reserved_tokens integer not null check (reserved_tokens > 0),
  actual_tokens integer,
  status text not null default 'reserved' check (status in ('reserved','completed','failed')),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.brain_task_contexts (
  task_id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  objective text not null check (char_length(objective) between 1 and 50000),
  complexity text not null check (complexity in ('easy','complex')),
  capabilities text[] not null default '{}',
  estimated_steps integer not null check (estimated_steps between 1 and 100),
  context jsonb not null default '{}'::jsonb,
  status text not null default 'running' check (status in ('running','completed','failed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.brain_task_steps (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.brain_task_contexts(task_id) on delete cascade,
  step_index integer not null check (step_index between 1 and 100),
  capability_key text not null references public.capabilities(key),
  description text not null check (char_length(description) between 1 and 5000),
  expected_inputs jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending','running','completed','failed')),
  result jsonb,
  unique (task_id, step_index)
);

create table if not exists public.brain_attempt_logs (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.brain_task_contexts(task_id) on delete cascade,
  step_index integer,
  tier_name text not null check (tier_name in ('router','worker','planner','merger')),
  model_id uuid references public.models(id) on delete set null,
  attempt_no integer not null check (attempt_no >= 1),
  status text not null check (status in ('success','timeout','error','empty')),
  error_code text,
  error_reason text,
  tokens_used integer not null default 0 check (tokens_used >= 0),
  created_at timestamptz not null default now()
);

create index if not exists brain_tiers_lookup_idx on public.brain_tiers(tier_name, is_active, priority);
create index if not exists model_capabilities_capability_idx on public.model_capabilities(capability_key, model_id);
create index if not exists brain_task_contexts_user_created_idx on public.brain_task_contexts(user_id, created_at desc);
create index if not exists brain_task_steps_task_status_idx on public.brain_task_steps(task_id, status, step_index);
create index if not exists brain_attempt_logs_task_created_idx on public.brain_attempt_logs(task_id, created_at desc);

insert into public.capabilities(key, label) values
  ('text', 'نص'), ('coding', 'برمجة'), ('image', 'صورة'), ('video', 'فيديو'),
  ('vision', 'رؤية'), ('audio', 'صوت'), ('reasoning', 'تفكير'), ('web_search', 'بحث على الويب')
on conflict (key) do update set label = excluded.label;

insert into public.plans(name, starting_brain_tier, daily_tasks_limit, daily_tokens_limit) values
  ('free', 'worker', 10, 20000),
  ('pro', 'planner', 100, 200000),
  ('max', 'planner', 1000, 2000000)
on conflict (name) do nothing;

-- Mirror the current catalog without changing ai_models. New rows can be linked
-- to a legacy model later through the admin panel before being activated in a tier.
insert into public.models(name, provider, cost_level, is_active, legacy_ai_model_id)
select m.name, p.provider_type, case when m.priority >= 8 then 'cheap' when m.priority >= 4 then 'medium' else 'expensive' end,
       m.enabled, m.id
from public.ai_models m
join public.ai_providers p on p.id = m.provider_id
where not exists (select 1 from public.models x where x.legacy_ai_model_id = m.id);

insert into public.model_capabilities(model_id, capability_key)
select id, 'text' from public.models where legacy_ai_model_id is not null
on conflict do nothing;
insert into public.model_capabilities(model_id, capability_key)
select id, 'coding' from public.models where legacy_ai_model_id is not null and lower(name) like '%code%'
on conflict do nothing;
insert into public.model_capabilities(model_id, capability_key)
select id, 'vision' from public.models where legacy_ai_model_id is not null and (lower(name) like '%vision%' or lower(name) like '%vl%')
on conflict do nothing;
insert into public.model_capabilities(model_id, capability_key)
select id, 'reasoning' from public.models where legacy_ai_model_id is not null and (lower(name) like '%reason%' or lower(name) like '%think%')
on conflict do nothing;

insert into public.brain_tiers(tier_name, priority, model_id, max_tokens_per_task)
select 'router', 1, id, 512 from public.models where is_active and legacy_ai_model_id is not null and cost_level = 'cheap' order by created_at limit 1
on conflict do nothing;
insert into public.brain_tiers(tier_name, priority, model_id, max_tokens_per_task)
select 'router', 2, id, 768 from public.models where is_active and legacy_ai_model_id is not null and cost_level in ('cheap','medium') order by created_at offset 1 limit 1
on conflict do nothing;
insert into public.brain_tiers(tier_name, priority, model_id, max_tokens_per_task)
select 'worker', 1, id, 2048 from public.models where is_active and legacy_ai_model_id is not null and cost_level = 'cheap' order by created_at limit 1
on conflict do nothing;
insert into public.brain_tiers(tier_name, priority, model_id, max_tokens_per_task)
select 'worker', 2, id, 4096 from public.models where is_active and legacy_ai_model_id is not null and cost_level in ('medium','expensive') order by created_at limit 1
on conflict do nothing;
insert into public.brain_tiers(tier_name, priority, model_id, max_tokens_per_task)
select 'planner', 1, id, 4096 from public.models where is_active and legacy_ai_model_id is not null and cost_level in ('medium','expensive') order by created_at limit 1
on conflict do nothing;
insert into public.brain_tiers(tier_name, priority, model_id, max_tokens_per_task)
select 'merger', 1, id, 4096 from public.models where is_active and legacy_ai_model_id is not null and cost_level in ('medium','expensive') order by created_at limit 1
on conflict do nothing;

alter table public.models enable row level security;
alter table public.capabilities enable row level security;
alter table public.model_capabilities enable row level security;
alter table public.brain_tiers enable row level security;
alter table public.plans enable row level security;
alter table public.brain_usage_daily enable row level security;
alter table public.brain_usage_events enable row level security;
alter table public.brain_task_contexts enable row level security;
alter table public.brain_task_steps enable row level security;
alter table public.brain_attempt_logs enable row level security;

create policy brain_models_admin_read on public.models for select to authenticated using (public.suly_is_admin());
create policy brain_models_admin_write on public.models for all to authenticated using (public.suly_is_admin()) with check (public.suly_is_admin());
create policy brain_capabilities_admin_read on public.capabilities for select to authenticated using (public.suly_is_admin());
create policy brain_capabilities_admin_write on public.capabilities for all to authenticated using (public.suly_is_admin()) with check (public.suly_is_admin());
create policy brain_model_capabilities_admin_read on public.model_capabilities for select to authenticated using (public.suly_is_admin());
create policy brain_model_capabilities_admin_write on public.model_capabilities for all to authenticated using (public.suly_is_admin()) with check (public.suly_is_admin());
create policy brain_tiers_admin_read on public.brain_tiers for select to authenticated using (public.suly_is_admin());
create policy brain_tiers_admin_write on public.brain_tiers for all to authenticated using (public.suly_is_admin()) with check (public.suly_is_admin());
create policy brain_plans_admin_read on public.plans for select to authenticated using (public.suly_is_admin());
create policy brain_plans_admin_write on public.plans for all to authenticated using (public.suly_is_admin()) with check (public.suly_is_admin());
create policy brain_task_context_owner_read on public.brain_task_contexts for select to authenticated using (user_id = auth.uid() or public.suly_is_admin());
create policy brain_task_steps_owner_read on public.brain_task_steps for select to authenticated using (exists (select 1 from public.brain_task_contexts c where c.task_id = public.brain_task_steps.task_id and (c.user_id = auth.uid() or public.suly_is_admin())));

revoke all on public.models, public.capabilities, public.model_capabilities, public.brain_tiers, public.plans from anon;
revoke all on public.brain_usage_daily, public.brain_usage_events, public.brain_task_contexts, public.brain_task_steps, public.brain_attempt_logs from anon, authenticated;
grant select, insert, update, delete on public.models, public.capabilities, public.model_capabilities, public.brain_tiers, public.plans to authenticated;
grant select on public.brain_task_contexts, public.brain_task_steps to authenticated;
grant all on public.models, public.capabilities, public.model_capabilities, public.brain_tiers, public.plans, public.brain_usage_daily, public.brain_usage_events, public.brain_task_contexts, public.brain_task_steps, public.brain_attempt_logs to service_role;

drop function if exists public.brain_reserve_usage(uuid, uuid, integer);
create function public.brain_reserve_usage(p_user_id uuid, p_task_id uuid, p_tokens integer)
returns jsonb language plpgsql security definer set search_path = pg_catalog, public, auth as $$
declare
  v_plan public.plans%rowtype;
  v_usage public.brain_usage_daily%rowtype;
  v_event public.brain_usage_events%rowtype;
  v_tier text;
  v_date date := current_date;
begin
  if coalesce(auth.role(), '') <> 'service_role' then raise exception 'service role required' using errcode = '42501'; end if;
  if p_user_id is null or p_task_id is null or p_tokens is null or p_tokens < 1 or p_tokens > 100000000 then raise exception 'invalid usage reservation' using errcode = '22023'; end if;
  select lower(coalesce(subscription_tier, 'free')) into v_tier from public.suly_profiles where id = p_user_id;
  select * into v_plan from public.plans where name = case when v_tier = 'pro' then 'pro' when v_tier in ('max','ultra') then 'max' else 'free' end limit 1;
  if not found then raise exception 'brain plan is not configured' using errcode = '55000'; end if;
  select * into v_event from public.brain_usage_events where task_id = p_task_id for update;
  if found then return jsonb_build_object('allowed', true, 'already_reserved', true, 'reserved_tokens', v_event.reserved_tokens); end if;
  insert into public.brain_usage_daily(user_id, usage_date) values (p_user_id, v_date) on conflict do nothing;
  select * into v_usage from public.brain_usage_daily where user_id = p_user_id and usage_date = v_date for update;
  if v_usage.tasks_used >= v_plan.daily_tasks_limit then return jsonb_build_object('allowed', false, 'error', 'daily_tasks_limit'); end if;
  if v_usage.tokens_used + v_usage.tokens_reserved + p_tokens > v_plan.daily_tokens_limit then return jsonb_build_object('allowed', false, 'error', 'daily_tokens_limit'); end if;
  update public.brain_usage_daily set tasks_used = tasks_used + 1, tokens_reserved = tokens_reserved + p_tokens where user_id = p_user_id and usage_date = v_date;
  insert into public.brain_usage_events(task_id, user_id, usage_date, reserved_tokens) values (p_task_id, p_user_id, v_date, p_tokens);
  return jsonb_build_object('allowed', true, 'already_reserved', false, 'reserved_tokens', p_tokens, 'plan', v_plan.name, 'daily_tokens_limit', v_plan.daily_tokens_limit);
end;
$$;

revoke all on function public.brain_reserve_usage(uuid, uuid, integer) from public, anon, authenticated;
grant execute on function public.brain_reserve_usage(uuid, uuid, integer) to service_role;

drop function if exists public.brain_finalize_usage(uuid, integer, text);
create function public.brain_finalize_usage(p_task_id uuid, p_actual_tokens integer, p_status text default 'completed')
returns jsonb language plpgsql security definer set search_path = pg_catalog, public, auth as $$
declare
  v_event public.brain_usage_events%rowtype;
  v_actual integer := greatest(0, coalesce(p_actual_tokens, 0));
begin
  if coalesce(auth.role(), '') <> 'service_role' then raise exception 'service role required' using errcode = '42501'; end if;
  select * into v_event from public.brain_usage_events where task_id = p_task_id for update;
  if not found then raise exception 'usage reservation not found' using errcode = 'P0002'; end if;
  if v_event.status <> 'reserved' then return jsonb_build_object('finalized', false, 'status', v_event.status, 'actual_tokens', v_event.actual_tokens); end if;
  update public.brain_usage_daily set tokens_reserved = greatest(0, tokens_reserved - v_event.reserved_tokens), tokens_used = tokens_used + least(v_actual, v_event.reserved_tokens) where user_id = v_event.user_id and usage_date = v_event.usage_date;
  update public.brain_usage_events set actual_tokens = least(v_actual, v_event.reserved_tokens), status = case when p_status in ('failed','completed') then p_status else 'completed' end, completed_at = now() where task_id = p_task_id;
  return jsonb_build_object('finalized', true, 'actual_tokens', least(v_actual, v_event.reserved_tokens), 'status', p_status);
end;
$$;
revoke all on function public.brain_finalize_usage(uuid, integer, text) from public, anon, authenticated;
grant execute on function public.brain_finalize_usage(uuid, integer, text) to service_role;

commit;
