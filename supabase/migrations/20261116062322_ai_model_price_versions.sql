-- Versioned, model-specific token pricing in EGP.
-- Provider costs are imported from the user's verified provider catalog.
-- Selling prices are generated with a fixed 40% markup; this catalog does not
-- alter credit settlement until the value of one credit in EGP is configured.
begin;

create table if not exists public.ai_model_price_versions (
  id uuid primary key default gen_random_uuid(),
  model_id integer not null references public.ai_models(id) on delete restrict,
  price_version integer not null check (price_version > 0),
  provider_input_cost_egp_per_million numeric(20,8) not null check (provider_input_cost_egp_per_million >= 0),
  provider_output_cost_egp_per_million numeric(20,8) not null check (provider_output_cost_egp_per_million >= 0),
  markup_rate numeric(6,5) not null default 0.40000 check (markup_rate = 0.40000),
  selling_input_egp_per_million numeric(20,8)
    generated always as (round(provider_input_cost_egp_per_million * (1 + markup_rate), 8)) stored,
  selling_output_egp_per_million numeric(20,8)
    generated always as (round(provider_output_cost_egp_per_million * (1 + markup_rate), 8)) stored,
  currency text not null default 'EGP' check (currency = 'EGP'),
  source_reference text not null default 'provider_catalog',
  is_current boolean not null default true,
  effective_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique(model_id, price_version)
);

create unique index if not exists ai_model_price_versions_one_current_idx
  on public.ai_model_price_versions(model_id) where is_current;
create index if not exists ai_model_price_versions_history_idx
  on public.ai_model_price_versions(model_id, price_version desc);

alter table public.ai_model_price_versions enable row level security;
drop policy if exists ai_model_price_versions_admin_read on public.ai_model_price_versions;
create policy ai_model_price_versions_admin_read
  on public.ai_model_price_versions for select to authenticated
  using ((select public.suly_is_admin()));
revoke all on public.ai_model_price_versions from anon, authenticated;
grant select on public.ai_model_price_versions to authenticated;
grant all on public.ai_model_price_versions to service_role;

create or replace function public.suly_admin_set_ai_model_price(
  p_model_id integer,
  p_provider_input_cost_egp_per_million numeric,
  p_provider_output_cost_egp_per_million numeric,
  p_expected_version integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_admin uuid := auth.uid();
  v_current_version integer;
  v_new_version integer;
  v_row public.ai_model_price_versions%rowtype;
begin
  if v_admin is null or not public.suly_is_admin() then
    raise exception 'administrator privileges required' using errcode = '42501';
  end if;
  if p_model_id is null
     or p_provider_input_cost_egp_per_million is null
     or p_provider_output_cost_egp_per_million is null
     or p_provider_input_cost_egp_per_million < 0
     or p_provider_output_cost_egp_per_million < 0 then
    raise exception 'invalid model pricing values' using errcode = '22023';
  end if;
  if not exists (select 1 from public.ai_models where id = p_model_id) then
    raise exception 'unknown model' using errcode = '22023';
  end if;

  select max(price_version) into v_current_version
  from public.ai_model_price_versions
  where model_id = p_model_id;
  if p_expected_version is not null
     and coalesce(v_current_version, 0) <> p_expected_version then
    raise exception 'price version conflict' using errcode = '40001';
  end if;

  v_new_version := coalesce(v_current_version, 0) + 1;
  update public.ai_model_price_versions
  set is_current = false
  where model_id = p_model_id and is_current;

  insert into public.ai_model_price_versions (
    model_id, price_version, provider_input_cost_egp_per_million,
    provider_output_cost_egp_per_million, markup_rate, currency,
    source_reference, is_current, effective_at, created_by
  ) values (
    p_model_id, v_new_version, p_provider_input_cost_egp_per_million,
    p_provider_output_cost_egp_per_million, 0.40000, 'EGP',
    'admin_price_update', true, now(), v_admin
  )
  returning * into v_row;

  insert into public.admin_audit_logs(admin_id, action, target_table, target_id, new_value, created_at)
  values (
    v_admin, 'ai_model_price_version_created', 'ai_model_price_versions', v_row.id::text,
    jsonb_build_object(
      'model_id', p_model_id, 'price_version', v_new_version,
      'provider_input_cost_egp_per_million', v_row.provider_input_cost_egp_per_million,
      'provider_output_cost_egp_per_million', v_row.provider_output_cost_egp_per_million,
      'selling_input_egp_per_million', v_row.selling_input_egp_per_million,
      'selling_output_egp_per_million', v_row.selling_output_egp_per_million,
      'markup_rate', 0.40000, 'currency', 'EGP'
    ), now()
  );

  return jsonb_build_object(
    'success', true, 'model_id', p_model_id, 'price_version', v_new_version,
    'provider_input_cost_egp_per_million', v_row.provider_input_cost_egp_per_million,
    'provider_output_cost_egp_per_million', v_row.provider_output_cost_egp_per_million,
    'selling_input_egp_per_million', v_row.selling_input_egp_per_million,
    'selling_output_egp_per_million', v_row.selling_output_egp_per_million,
    'markup_rate', 0.40000, 'currency', 'EGP'
  );
end;
$$;

revoke all on function public.suly_admin_set_ai_model_price(integer,numeric,numeric,integer) from public, anon;
grant execute on function public.suly_admin_set_ai_model_price(integer,numeric,numeric,integer) to authenticated;

create temporary table ai_model_price_seed on commit drop as
select * from (values
  ('claude-opus-5-5',232.00,1160.00),
  ('claude-sonnet-5-5',116.00,580.00),
  ('claude-fable-5-1',580.00,2900.00),
  ('claude-opus-5',290.00,1450.00),
  ('claude-sonnet-5',116.00,580.00),
  ('claude-fable-5',580.00,2900.00),
  ('claude-opus-4-8',290.00,1450.00),
  ('claude-opus-4-7',290.00,1450.00),
  ('claude-opus-4-6',290.00,1450.00),
  ('claude-opus-4-5-20251101',290.00,1450.00),
  ('claude-sonnet-4-6',174.00,870.00),
  ('claude-sonnet-4-5-20250929',174.00,870.00),
  ('claude-haiku-4-5-20251001',58.00,290.00),
  ('claude-haiku-5-5',5.80,29.00),
  ('gpt-6-astra',580.00,2900.00),
  ('gpt-6-sol',116.00,580.00),
  ('gpt-6-luna',5.80,29.00),
  ('gpt-5.6-sol',232.00,1160.00),
  ('gpt-5.6-terra',116.00,696.00),
  ('gpt-5.6-luna',11.60,69.60),
  ('gpt-5.5',290.00,1740.00),
  ('gpt-5.4',145.00,870.00),
  ('gpt-5.2',101.50,812.00),
  ('gpt-5.1',72.50,580.00),
  ('gpt-5',72.50,580.00),
  ('o3-pro',116.00,464.00),
  ('o4-mini',63.80,255.20),
  ('gpt-4o',145.00,580.00),
  ('gpt-4.1',116.00,464.00),
  ('gpt-5.4-mini',43.50,261.00),
  ('gpt-5-mini',14.50,116.00),
  ('gpt-4.1-mini',23.20,92.80),
  ('gpt-4o-mini',8.70,34.80),
  ('gpt-4.1-nano',5.80,23.20),
  ('gpt-5-nano',2.90,23.20),
  ('gemini-4-argon',232.00,1160.00),
  ('gemini-3.1-pro-preview',116.00,696.00),
  ('gemini-3.8-flash',43.50,217.50),
  ('gemini-3.7-flash',43.50,217.50),
  ('gemini-3.6-flash',43.50,217.50),
  ('gemini-2.5-pro',72.50,580.00),
  ('gemini-3.5-flash',87.00,522.00),
  ('gemini-3-flash-preview',29.00,174.00),
  ('gemini-2.5-flash',17.40,145.00)
) as seed(model_identifier,input_cost,output_cost);

do $$
declare v_seeded integer;
begin
  select count(*) into v_seeded
  from ai_model_price_seed s
  join public.ai_models m on m.provider_id = 22 and m.model_identifier = s.model_identifier;
  if v_seeded <> 44 then
    raise exception 'expected 44 verified text models for provider 22, found %', v_seeded;
  end if;
  insert into public.ai_model_price_versions (
    model_id, price_version, provider_input_cost_egp_per_million,
    provider_output_cost_egp_per_million, markup_rate, currency,
    source_reference, is_current, effective_at
  )
  select m.id, 1, s.input_cost, s.output_cost, 0.40000, 'EGP',
         'provider_catalog_2026-11-16', true, now()
  from ai_model_price_seed s
  join public.ai_models m on m.provider_id = 22 and m.model_identifier = s.model_identifier
  on conflict (model_id, price_version) do nothing;
end;
$$;

comment on table public.ai_model_price_versions is
  'Versioned EGP provider and selling prices per one million input/output tokens. Selling price is generated with a fixed 40% markup. Not a credit settlement source until credit value in EGP is configured.';
commit;
