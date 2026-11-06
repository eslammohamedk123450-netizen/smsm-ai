-- Model racing, paid fallback, and future customer plan access.
-- Additive migration written for the live SULY schema (suly_profiles/ai_models).

begin;

alter table public.suly_profiles
  add column if not exists subscription_tier text not null default 'free';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'suly_profiles_subscription_tier_check'
      and conrelid = 'public.suly_profiles'::regclass
  ) then
    alter table public.suly_profiles
      add constraint suly_profiles_subscription_tier_check
      check (subscription_tier in ('free', 'lite', 'pro', 'max'));
  end if;
end
$$;

alter table public.ai_models
  add column if not exists routing_group text not null default 'free_race',
  add column if not exists allowed_tiers text[] not null default array['free', 'lite', 'pro', 'max']::text[];

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'ai_models_routing_group_check'
      and conrelid = 'public.ai_models'::regclass
  ) then
    alter table public.ai_models
      add constraint ai_models_routing_group_check
      check (routing_group in ('free_race', 'paid_fallback', 'disabled'));
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'ai_models_allowed_tiers_check'
      and conrelid = 'public.ai_models'::regclass
  ) then
    alter table public.ai_models
      add constraint ai_models_allowed_tiers_check
      check (allowed_tiers <@ array['free', 'lite', 'pro', 'max']::text[]);
  end if;
end
$$;

update public.ai_models as m
set routing_group = case
  when lower(p.provider_type) = 'groq'
    or lower(m.model_identifier) like '%:free'
    then 'free_race'
  else 'paid_fallback'
end
from public.ai_providers as p
where p.id = m.provider_id;

create index if not exists ai_models_router_group_enabled_idx
  on public.ai_models (routing_group, enabled, priority desc);

create table if not exists public.ai_router_settings (
  id integer primary key default 1 check (id = 1),
  free_race_timeout_ms integer not null default 5000
    check (free_race_timeout_ms between 1000 and 30000),
  paid_fallback_enabled boolean not null default true,
  paid_fallback_timeout_ms integer not null default 30000
    check (paid_fallback_timeout_ms between 1000 and 120000),
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

insert into public.ai_router_settings (id)
values (1)
on conflict (id) do nothing;

alter table public.ai_router_settings enable row level security;
drop policy if exists "Admins manage ai router settings" on public.ai_router_settings;
create policy "Admins manage ai router settings"
  on public.ai_router_settings
  for all
  to authenticated
  using (public.suly_is_admin())
  with check (public.suly_is_admin());

revoke all on table public.ai_router_settings from public, anon, authenticated;
grant select, update on table public.ai_router_settings to authenticated;
grant all on table public.ai_router_settings to service_role;

commit;
