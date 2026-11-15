-- SULY public model levels and subscription entitlement mapping.
-- This is an additive development migration. It reuses ai_models and the existing
-- subscription/credit ledgers; it does not create a second provider catalog or wallet.

begin;

alter table public.subscription_plans
  add column if not exists tier_key text;

update public.subscription_plans
set tier_key = case
  when regexp_replace(lower(coalesce(name, '')), '[^a-z0-9]+', '', 'g') in ('free','basic') then 'free'
  when regexp_replace(lower(coalesce(name, '')), '[^a-z0-9]+', '', 'g') = 'lite' then 'lite'
  when regexp_replace(lower(coalesce(name, '')), '[^a-z0-9]+', '', 'g') in ('pro','professional') then 'pro'
  when regexp_replace(lower(coalesce(name, '')), '[^a-z0-9]+', '', 'g') in ('max','maximum') then 'max'
  when regexp_replace(lower(coalesce(name, '')), '[^a-z0-9]+', '', 'g') = 'ultra' then 'ultra'
  else coalesce(nullif(tier_key, ''), 'free')
end
where tier_key is null or tier_key = '';

update public.subscription_plans
set description = case tier_key
  when 'free' then 'SULY Lite المجاني للمهام السريعة واليومية، مع حدود استخدام أساسية.'
  when 'lite' then 'SULY Lite بحدود استخدام أكبر للمحادثات والطلبات اليومية الخفيفة.'
  when 'pro' then 'SULY Pro للتوازن بين السرعة والذكاء والقدرات، مناسب للبرمجة والبحث والتحليل والمهام المركبة.'
  when 'max' then 'SULY Max للمهام المعقدة والتحليل العميق والبرمجة المتقدمة، مع حدود تنفيذ وقدرات أوسع.'
  else description
end
where tier_key in ('free', 'lite', 'pro', 'max');

alter table public.subscription_plans
  alter column tier_key set default 'free',
  alter column tier_key set not null;

-- Retire the legacy Ultra plan while preserving its historical row.
-- Existing Ultra subscribers inherit Max access rather than being downgraded.
update public.subscription_plans
set tier_key = 'max', is_active = false, updated_at = now()
where tier_key = 'ultra' or lower(name) = 'ultra';

update public.suly_profiles
set subscription_tier = 'max'
where subscription_tier = 'ultra';

update public.ai_models
set allowed_tiers = array(
  select distinct case when tier = 'ultra' then 'max' else tier end
  from unnest(allowed_tiers) as tier
)
where 'ultra' = any(allowed_tiers);

alter table public.subscription_plans
  drop constraint if exists subscription_plans_tier_key_check;
alter table public.subscription_plans
  add constraint subscription_plans_tier_key_check
  check (tier_key in ('free', 'lite', 'pro', 'max'));

alter table public.suly_profiles
  drop constraint if exists suly_profiles_subscription_tier_check;
alter table public.suly_profiles
  add constraint suly_profiles_subscription_tier_check
  check (subscription_tier in ('free', 'lite', 'pro', 'max'));

alter table public.ai_models
  alter column allowed_tiers set default array['free','lite','pro','max']::text[];
alter table public.ai_models
  drop constraint if exists ai_models_allowed_tiers_check;
alter table public.ai_models
  add constraint ai_models_allowed_tiers_check
  check (allowed_tiers <@ array['free','lite','pro','max']::text[]);

update public.subscription_plans
set name = case tier_key
    when 'free' then 'SULY Lite Free'
    when 'lite' then 'SULY Lite'
    when 'pro' then 'SULY Pro'
    when 'max' then 'SULY Max'
    else name
  end,
  description = case tier_key
    when 'free' then 'SULY Lite مجانًا للمهام السريعة واليومية مع حدود استخدام أساسية.'
    when 'lite' then 'SULY Lite المدفوع للمهام اليومية مع حدود استخدام ورصيد أكبر.'
    when 'pro' then 'SULY Pro: توازن بين السرعة والذكاء والقدرات للبرمجة والبحث والتحليل.'
    when 'max' then 'SULY Max: للمهام المعقدة والتحليل العميق والبرمجة المتقدمة مع سياق أطول.'
    else description
  end,
  updated_at = now()
where tier_key in ('free','lite','pro','max')
  and not (is_active = false and lower(name) = 'ultra');

update public.subscription_plans
set name = 'SULY Ultra (Retired)', updated_at = now()
where is_active = false and tier_key = 'max' and id = 5;

create table if not exists public.suly_model_profiles (
  profile_key text primary key check (profile_key in ('lite', 'pro', 'max')),
  display_name text not null check (length(btrim(display_name)) between 1 and 80),
  tagline text not null default '',
  description text not null default '',
  icon_key text not null default 'sparkles',
  sort_order integer not null default 0,
  minimum_subscription_tier text not null
    check (minimum_subscription_tier in ('free', 'lite', 'pro', 'max')),
  capabilities_json jsonb not null default '{}'::jsonb
    check (jsonb_typeof(capabilities_json) = 'object'),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.suly_model_profiles
  (profile_key, display_name, tagline, description, icon_key, sort_order, minimum_subscription_tier, capabilities_json, is_active)
values
  ('lite', 'SULY Lite', 'للمهام السريعة واليومية',
   'للمحادثات والأسئلة والكتابة والطلبات اليومية الخفيفة، مع استجابة سريعة واستهلاك اقتصادي.',
   'zap', 1, 'free',
   '{"chat":true,"quick_tasks":true,"web_search":false,"multi_step_agent":false,"advanced_reasoning":false}',
   true),
  ('pro', 'SULY Pro', 'توازن بين السرعة والذكاء والقدرات',
   'للبرمجة والبحث والتحليل والمهام المتوسطة والمركبة، مع قدرة أكبر على استخدام الأدوات وتقسيم العمل عند الحاجة.',
   'rocket', 2, 'pro',
   '{"chat":true,"quick_tasks":true,"web_search":true,"multi_step_agent":true,"advanced_reasoning":true}',
   true),
  ('max', 'SULY Max', 'للمهام المعقدة والتحليل العميق',
   'للتخطيط متعدد الخطوات والتحليل العميق والبرمجة المتقدمة، مع سياق أطول عند توفر نموذج يدعمه.',
   'diamond', 3, 'max',
   '{"chat":true,"quick_tasks":true,"web_search":true,"multi_step_agent":true,"advanced_reasoning":true,"extended_context":true}',
   true)
on conflict (profile_key) do update set
  display_name = excluded.display_name,
  tagline = excluded.tagline,
  description = excluded.description,
  icon_key = excluded.icon_key,
  sort_order = excluded.sort_order,
  minimum_subscription_tier = excluded.minimum_subscription_tier,
  capabilities_json = excluded.capabilities_json,
  updated_at = now();

create table if not exists public.suly_model_profile_models (
  id bigint generated by default as identity primary key,
  profile_key text not null references public.suly_model_profiles(profile_key) on update cascade on delete cascade,
  model_id integer not null references public.ai_models(id) on delete cascade,
  route_role text not null check (route_role in ('chat','planner','worker','reviewer','summarizer')),
  priority integer not null default 100 check (priority between 1 and 10000),
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(profile_key, model_id, route_role)
);

create index if not exists suly_model_profile_models_route_idx
  on public.suly_model_profile_models(profile_key, route_role, enabled, priority);

-- Seed profile-to-model mappings from the existing provider/model catalog.
-- Admins can refine these mappings later; no provider/model records are duplicated.
insert into public.suly_model_profile_models(profile_key, model_id, route_role, priority, enabled)
select
  profile.profile_key,
  model.id,
  role.route_role,
  row_number() over (
    partition by profile.profile_key, role.route_role
    order by model.priority desc, model.id
  )::integer,
  true
from public.suly_model_profiles profile
join public.ai_models model
  on model.enabled = true
 and model.routing_group <> 'disabled'
 and exists (
   select 1
   from unnest(coalesce(model.allowed_tiers, array[]::text[])) as allowed_tier
   where array_position(array['free','lite','pro','max']::text[], allowed_tier)
     <= array_position(array['free','lite','pro','max']::text[], profile.profile_key)
 )
cross join lateral (
  select unnest(array['chat','planner','worker','reviewer','summarizer']::text[]) as route_role
) role
where
  (role.route_role = 'chat' and coalesce(model.capabilities_json, '{"chat":true}')::jsonb ->> 'chat' is distinct from 'false')
  or (role.route_role = 'planner' and (coalesce(model.task_roles, array['general']::text[]) && array['general','planner']))
  or (role.route_role = 'worker' and (coalesce(model.task_roles, array['general']::text[]) && array['general','worker','executor']))
  or (role.route_role = 'reviewer' and (coalesce(model.task_roles, array['general']::text[]) && array['general','reviewer']))
  or (role.route_role = 'summarizer' and (coalesce(model.task_roles, array['general']::text[]) && array['general','summarizer']))
on conflict (profile_key, model_id, route_role) do nothing;

alter table public.suly_model_profiles enable row level security;
alter table public.suly_model_profile_models enable row level security;

drop policy if exists suly_model_profiles_read_active on public.suly_model_profiles;
create policy suly_model_profiles_read_active on public.suly_model_profiles
  for select to authenticated using (is_active = true or public.suly_is_admin());
drop policy if exists suly_model_profiles_admin_write on public.suly_model_profiles;
create policy suly_model_profiles_admin_write on public.suly_model_profiles
  for all to authenticated using (public.suly_is_admin()) with check (public.suly_is_admin());

drop policy if exists suly_model_profile_models_admin_read on public.suly_model_profile_models;
create policy suly_model_profile_models_admin_read on public.suly_model_profile_models
  for select to authenticated using (public.suly_is_admin());
drop policy if exists suly_model_profile_models_admin_write on public.suly_model_profile_models;
create policy suly_model_profile_models_admin_write on public.suly_model_profile_models
  for all to authenticated using (public.suly_is_admin()) with check (public.suly_is_admin());

revoke all on public.suly_model_profiles, public.suly_model_profile_models from anon;
grant select on public.suly_model_profiles to authenticated;
grant select, insert, update, delete on public.suly_model_profiles to authenticated;
grant select, insert, update, delete on public.suly_model_profile_models to authenticated;
grant usage, select on sequence public.suly_model_profile_models_id_seq to authenticated, service_role;
grant all on public.suly_model_profiles, public.suly_model_profile_models to service_role;

commit;
