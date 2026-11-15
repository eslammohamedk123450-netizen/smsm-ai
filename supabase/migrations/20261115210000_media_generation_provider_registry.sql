-- External provider-backed media model registry.
-- Provider identities and credentials reuse ai_providers/Vault; this table only
-- describes service-specific model protocols and commercial settings.

begin;

create table if not exists public.suly_media_generation_models (
  id uuid primary key default gen_random_uuid(),
  service_type text not null check (service_type in ('image','video')),
  display_name text not null check (length(btrim(display_name)) between 1 and 100),
  provider_id integer not null references public.ai_providers(id) on delete restrict,
  model_identifier text not null check (length(btrim(model_identifier)) between 1 and 200),
  protocol text not null check (protocol in ('openai_images','openai_video')),
  endpoint_url text not null check (endpoint_url ~* '^https://'),
  allowed_tiers text[] not null default array['free','lite','pro','max']::text[]
    check (allowed_tiers <@ array['free','lite','pro','max']::text[]),
  supported_qualities text[] not null default array['standard']::text[],
  capabilities_json jsonb not null default '{}'::jsonb
    check (jsonb_typeof(capabilities_json) = 'object'),
  is_default boolean not null default false,
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(service_type, provider_id, model_identifier)
);

create index if not exists suly_media_generation_models_service_idx
  on public.suly_media_generation_models(service_type, is_active, is_default);

create unique index if not exists suly_media_generation_models_one_default_idx
  on public.suly_media_generation_models(service_type) where is_default = true and is_active = true;

create table if not exists public.suly_media_generation_prices (
  id uuid primary key default gen_random_uuid(),
  generation_model_id uuid not null references public.suly_media_generation_models(id) on delete cascade,
  quality text not null check (quality in ('economy','standard','high','ultra')),
  price_credits bigint not null check (price_credits > 0 and price_credits <= 1000000000),
  estimated_provider_cost_usd numeric(20,8) not null default 0 check (estimated_provider_cost_usd >= 0),
  target_margin numeric(6,5) not null default 0.30000 check (target_margin >= 0 and target_margin <= 0.95),
  credit_value_egp numeric(20,8) not null default 0 check (credit_value_egp >= 0),
  usd_to_egp numeric(20,8) not null default 0 check (usd_to_egp >= 0),
  resolution text not null default '1024x1024',
  unit_type text not null default 'image' check (unit_type in ('image','second')),
  enabled boolean not null default false,
  price_version integer not null default 1 check (price_version > 0),
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(generation_model_id, quality)
);

create index if not exists suly_media_generation_prices_lookup_idx
  on public.suly_media_generation_prices(generation_model_id, quality, enabled);

alter table public.suly_media_generation_models enable row level security;
alter table public.suly_media_generation_prices enable row level security;

drop policy if exists suly_media_generation_models_public_read on public.suly_media_generation_models;
drop policy if exists suly_media_generation_models_admin_read on public.suly_media_generation_models;
create policy suly_media_generation_models_admin_read on public.suly_media_generation_models
  for select to authenticated using (public.suly_is_admin());
drop policy if exists suly_media_generation_models_admin_write on public.suly_media_generation_models;
create policy suly_media_generation_models_admin_write on public.suly_media_generation_models
  for all to authenticated using (public.suly_is_admin()) with check (public.suly_is_admin());

drop policy if exists suly_media_generation_prices_public_read on public.suly_media_generation_prices;
drop policy if exists suly_media_generation_prices_admin_read on public.suly_media_generation_prices;
create policy suly_media_generation_prices_admin_read on public.suly_media_generation_prices
  for select to authenticated using (public.suly_is_admin());
drop policy if exists suly_media_generation_prices_admin_write on public.suly_media_generation_prices;
create policy suly_media_generation_prices_admin_write on public.suly_media_generation_prices
  for all to authenticated using (public.suly_is_admin()) with check (public.suly_is_admin());

revoke all on public.suly_media_generation_models, public.suly_media_generation_prices from anon;
grant select on public.suly_media_generation_models, public.suly_media_generation_prices to authenticated;
grant insert, update, delete on public.suly_media_generation_models, public.suly_media_generation_prices to authenticated;
grant all on public.suly_media_generation_models, public.suly_media_generation_prices to service_role;

alter table public.suly_company_cost_ledger
  add column if not exists generation_model_id uuid
  references public.suly_media_generation_models(id) on delete set null;

create index if not exists suly_company_cost_ledger_generation_model_idx
  on public.suly_company_cost_ledger(generation_model_id, created_at desc);

-- Expose only customer-safe model names and selling/reservation prices. Provider
-- endpoints, identifiers, FX rates, provider cost and margin stay admin-only.
create or replace function public.suly_list_public_image_models()
returns table (
  id uuid,
  display_name text,
  supported_qualities text[],
  is_default boolean,
  prices jsonb
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_tier text;
  v_tier_rank integer;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  select coalesce(subscription_tier, 'free') into v_tier
  from public.suly_profiles where id = v_user_id;
  v_tier_rank := coalesce(array_position(array['free','lite','pro','max']::text[], v_tier), 1);

  return query
  select model.id, model.display_name, model.supported_qualities, model.is_default,
    coalesce(jsonb_agg(jsonb_build_object(
      'quality', price.quality, 'price_credits', price.price_credits, 'resolution', price.resolution
    ) order by price.quality) filter (where price.id is not null), '[]'::jsonb) as prices
  from public.suly_media_generation_models model
  left join public.suly_media_generation_prices price
    on price.generation_model_id = model.id and price.enabled = true
  where model.service_type = 'image' and model.is_active = true
    and (public.suly_is_admin() or exists (
      select 1 from unnest(model.allowed_tiers) as allowed_tier
      where array_position(array['free','lite','pro','max']::text[], allowed_tier) <= v_tier_rank
    ))
  group by model.id, model.display_name, model.supported_qualities, model.is_default
  having count(price.id) > 0
  order by model.is_default desc, model.display_name;
end;
$$;

revoke all on function public.suly_list_public_image_models() from public, anon;
grant execute on function public.suly_list_public_image_models() to authenticated;

commit;
