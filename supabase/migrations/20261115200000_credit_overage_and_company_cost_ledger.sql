-- Actual-cost settlement and company-side provider cost ledger.
-- A completed provider job is always settled at its full measured/confirmed
-- credit charge, even when this moves the user's spendable balance below zero.

begin;

alter table public.suly_credit_accounts
  drop constraint if exists suly_credit_accounts_balance_check;
alter table public.suly_credit_accounts
  add constraint suly_credit_accounts_balance_check
  check (balance >= -1000000000);

alter table public.suly_credit_transactions
  drop constraint if exists suly_credit_transactions_balance_after_check;
alter table public.suly_credit_transactions
  add constraint suly_credit_transactions_balance_after_check
  check (balance_after >= -1000000000);

alter table public.suly_credit_pricing
  add column if not exists negative_balance_limit bigint not null default 5000
  check (negative_balance_limit between 0 and 1000000000);

create or replace function public.finalize_credits(
  p_user_id uuid,
  p_task_id uuid,
  p_actual_cost bigint,
  p_input_tokens integer default 0,
  p_output_tokens integer default 0,
  p_model_id integer default null,
  p_source text default 'ai_request'
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_account public.suly_credit_accounts%rowtype;
  v_hold public.suly_credit_holds%rowtype;
  v_charge bigint;
  v_extra bigint;
  v_release bigint;
  v_balance bigint;
  v_reserved bigint;
  v_negative_limit bigint := 5000;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service role required' using errcode = '42501';
  end if;
  if p_user_id is null or p_task_id is null or p_actual_cost is null or p_actual_cost < 0
    or p_actual_cost > 1000000000 or coalesce(p_input_tokens, 0) < 0 or coalesce(p_output_tokens, 0) < 0 then
    raise exception 'invalid finalization parameters' using errcode = '22023';
  end if;

  select * into v_account from public.suly_credit_accounts where user_id = p_user_id for update;
  if not found then
    return jsonb_build_object('success', false, 'error', 'account_not_found');
  end if;
  select * into v_hold from public.suly_credit_holds where task_id = p_task_id and user_id = p_user_id for update;
  if not found then
    return jsonb_build_object('success', false, 'error', 'hold_not_found');
  end if;
  if v_hold.status in ('settled', 'expired') then
    return jsonb_build_object('success', true, 'already_finalized', true,
      'charged', coalesce(v_hold.charged_amount, 0), 'actual_cost', coalesce(v_hold.actual_cost, 0),
      'balance', v_account.balance, 'reserved_balance', v_account.reserved_balance);
  end if;
  if v_account.reserved_balance < v_hold.reserved_amount then
    raise exception 'reserved balance invariant violated' using errcode = '23514';
  end if;

  select coalesce(negative_balance_limit, 5000) into v_negative_limit
  from public.suly_credit_pricing where id = 1;

  -- The provider has already performed the work. Never cap settlement at the
  -- remaining wallet balance: record the full charge and carry the overage as debt.
  v_charge := p_actual_cost;
  v_extra := greatest(v_charge - v_hold.reserved_amount, 0);
  v_release := greatest(v_hold.reserved_amount - v_charge, 0);

  update public.suly_credit_accounts
    set balance = balance - v_extra + v_release,
        reserved_balance = reserved_balance - v_hold.reserved_amount,
        updated_at = now()
    where user_id = p_user_id
    returning balance, reserved_balance into v_balance, v_reserved;

  update public.suly_credit_holds
    set status = 'settled', actual_cost = p_actual_cost, charged_amount = v_charge,
        input_tokens = coalesce(p_input_tokens, 0), output_tokens = coalesce(p_output_tokens, 0),
        model_id = p_model_id, settled_at = now()
    where task_id = p_task_id;

  insert into public.suly_credit_transactions(
    user_id, hold_id, event_type, amount, balance_delta, reserved_delta,
    balance_after, reserved_after, actual_cost, input_tokens, output_tokens,
    model_id, source, reason
  ) values (
    p_user_id, p_task_id, 'settle', v_charge, v_release - v_extra, -v_hold.reserved_amount,
    v_balance, v_reserved, p_actual_cost, coalesce(p_input_tokens, 0),
    coalesce(p_output_tokens, 0), p_model_id, coalesce(nullif(p_source, ''), 'ai_request'),
    case when v_balance < -v_negative_limit
      then 'Actual provider cost exceeded reservation and crossed the configured negative-balance alert threshold'
      when v_extra > 0 then 'Actual cost exceeded the reserved amount; overage carried as negative balance'
      else null end
  );

  return jsonb_build_object('success', true, 'charged', v_charge,
    'actual_cost', p_actual_cost, 'balance', v_balance, 'reserved_balance', v_reserved,
    'overage', v_extra, 'negative_limit', v_negative_limit,
    'negative_limit_exceeded', v_balance < -v_negative_limit);
end;
$$;

revoke all on function public.finalize_credits(uuid, uuid, bigint, integer, integer, integer, text) from public, anon, authenticated;
grant execute on function public.finalize_credits(uuid, uuid, bigint, integer, integer, integer, text) to service_role;

create or replace function public.suly_admin_update_negative_balance_limit(p_limit bigint)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_admin uuid := auth.uid();
begin
  if v_admin is null or not public.suly_is_admin() then
    raise exception 'administrator privileges required' using errcode = '42501';
  end if;
  if p_limit is null or p_limit < 0 or p_limit > 1000000000 then
    raise exception 'negative balance alert threshold is invalid' using errcode = '22023';
  end if;
  update public.suly_credit_pricing
    set negative_balance_limit = p_limit, updated_by = v_admin, updated_at = now()
    where id = 1;
  return jsonb_build_object('success', true, 'negative_balance_limit', p_limit);
end;
$$;
revoke all on function public.suly_admin_update_negative_balance_limit(bigint) from public, anon;
grant execute on function public.suly_admin_update_negative_balance_limit(bigint) to authenticated;

create table if not exists public.suly_company_cost_ledger (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique,
  user_id uuid references auth.users(id) on delete set null,
  service_type text not null check (service_type in ('chat','image','video')),
  provider_id integer references public.ai_providers(id) on delete set null,
  model_id integer references public.ai_models(id) on delete set null,
  provider_model_identifier text,
  provider_cost_usd numeric(20,8) not null default 0 check (provider_cost_usd >= 0),
  cost_status text not null default 'estimated' check (cost_status in ('estimated','confirmed','reconciled')),
  user_credits_charged bigint not null default 0 check (user_credits_charged >= 0),
  credit_value_egp numeric(20,8) not null default 0 check (credit_value_egp >= 0),
  usd_to_egp numeric(20,8) not null default 0 check (usd_to_egp >= 0),
  revenue_egp numeric(20,8) not null default 0,
  provider_cost_egp numeric(20,8) not null default 0,
  other_cost_egp numeric(20,8) not null default 0,
  gross_profit_egp numeric(20,8) not null default 0,
  price_version text,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists suly_company_cost_ledger_created_idx
  on public.suly_company_cost_ledger(created_at desc);
create index if not exists suly_company_cost_ledger_provider_idx
  on public.suly_company_cost_ledger(provider_id, created_at desc);
create index if not exists suly_company_cost_ledger_service_idx
  on public.suly_company_cost_ledger(service_type, created_at desc);
create index if not exists suly_company_cost_ledger_user_idx
  on public.suly_company_cost_ledger(user_id, created_at desc);

alter table public.suly_company_cost_ledger enable row level security;
drop policy if exists suly_company_cost_ledger_admin_read on public.suly_company_cost_ledger;
create policy suly_company_cost_ledger_admin_read on public.suly_company_cost_ledger
  for select to authenticated using (public.suly_is_admin());
revoke all on public.suly_company_cost_ledger from public, anon, authenticated;
grant select on public.suly_company_cost_ledger to authenticated;
grant all on public.suly_company_cost_ledger to service_role;

create or replace function public.suly_service_record_company_cost(
  p_request_id uuid,
  p_user_id uuid,
  p_service_type text,
  p_provider_id integer,
  p_model_id integer,
  p_provider_model_identifier text,
  p_provider_cost_usd numeric,
  p_cost_status text,
  p_user_credits_charged bigint,
  p_credit_value_egp numeric,
  p_usd_to_egp numeric,
  p_other_cost_egp numeric default 0,
  p_price_version text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_row public.suly_company_cost_ledger%rowtype;
  v_revenue numeric(20,8);
  v_provider_egp numeric(20,8);
  v_other numeric(20,8);
  v_inserted_rows integer := 0;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service role required' using errcode = '42501';
  end if;
  if p_request_id is null or p_service_type not in ('chat','image','video')
    or coalesce(p_provider_cost_usd, -1) < 0 or coalesce(p_user_credits_charged, -1) < 0
    or coalesce(p_credit_value_egp, -1) < 0 or coalesce(p_usd_to_egp, -1) < 0
    or coalesce(p_other_cost_egp, -1) < 0
    or p_cost_status not in ('estimated','confirmed','reconciled') then
    raise exception 'invalid company cost ledger parameters' using errcode = '22023';
  end if;
  v_revenue := p_user_credits_charged * p_credit_value_egp;
  v_provider_egp := p_provider_cost_usd * p_usd_to_egp;
  v_other := coalesce(p_other_cost_egp, 0);

  insert into public.suly_company_cost_ledger(
    request_id,user_id,service_type,provider_id,model_id,provider_model_identifier,
    provider_cost_usd,cost_status,user_credits_charged,credit_value_egp,usd_to_egp,
    revenue_egp,provider_cost_egp,other_cost_egp,gross_profit_egp,price_version,metadata
  ) values (
    p_request_id,p_user_id,p_service_type,p_provider_id,p_model_id,p_provider_model_identifier,
    p_provider_cost_usd,p_cost_status,p_user_credits_charged,p_credit_value_egp,p_usd_to_egp,
    v_revenue,v_provider_egp,v_other,v_revenue-v_provider_egp-v_other,p_price_version,
    coalesce(p_metadata,'{}'::jsonb)
  ) on conflict (request_id) do nothing;
  get diagnostics v_inserted_rows = row_count;

  select * into v_row from public.suly_company_cost_ledger where request_id = p_request_id;
  return jsonb_build_object('success', true, 'already_recorded', v_inserted_rows = 0,
    'request_id', v_row.request_id, 'revenue_egp', v_row.revenue_egp,
    'provider_cost_egp', v_row.provider_cost_egp, 'gross_profit_egp', v_row.gross_profit_egp,
    'cost_status', v_row.cost_status);
end;
$$;

revoke all on function public.suly_service_record_company_cost(uuid,uuid,text,integer,integer,text,numeric,text,bigint,numeric,numeric,numeric,text,jsonb) from public, anon, authenticated;
grant execute on function public.suly_service_record_company_cost(uuid,uuid,text,integer,integer,text,numeric,text,bigint,numeric,numeric,numeric,text,jsonb) to service_role;

commit;
