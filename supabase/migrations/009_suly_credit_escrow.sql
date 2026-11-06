-- Suly-agent hybrid credits: append-only ledger + atomic escrow.
-- Existing legacy credit_transactions/users tables are intentionally untouched.

begin;

create table if not exists public.suly_credit_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  balance bigint not null default 0 check (balance >= 0),
  reserved_balance bigint not null default 0 check (reserved_balance >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.suly_credit_holds (
  task_id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  conversation_id uuid references public.suly_conversations(id) on delete set null,
  reserved_amount bigint not null check (reserved_amount > 0),
  actual_cost bigint check (actual_cost is null or actual_cost >= 0),
  charged_amount bigint check (charged_amount is null or charged_amount >= 0),
  input_tokens integer not null default 0 check (input_tokens >= 0),
  output_tokens integer not null default 0 check (output_tokens >= 0),
  model_id integer references public.ai_models(id) on delete set null,
  status text not null default 'held' check (status in ('held', 'settled', 'expired')),
  created_at timestamptz not null default now(),
  settled_at timestamptz
);

create index if not exists suly_credit_holds_user_created_idx
  on public.suly_credit_holds(user_id, created_at desc);
create index if not exists suly_credit_holds_status_created_idx
  on public.suly_credit_holds(status, created_at);

create table if not exists public.suly_credit_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  hold_id uuid references public.suly_credit_holds(task_id) on delete set null,
  request_id uuid,
  event_type text not null check (event_type in ('reserve', 'settle', 'expire', 'admin_adjust')),
  amount bigint not null,
  balance_delta bigint not null,
  reserved_delta bigint not null,
  balance_after bigint not null check (balance_after >= 0),
  reserved_after bigint not null check (reserved_after >= 0),
  actual_cost bigint check (actual_cost is null or actual_cost >= 0),
  input_tokens integer not null default 0 check (input_tokens >= 0),
  output_tokens integer not null default 0 check (output_tokens >= 0),
  model_id integer references public.ai_models(id) on delete set null,
  source text not null,
  reason text,
  created_at timestamptz not null default now()
);

create index if not exists suly_credit_transactions_user_created_idx
  on public.suly_credit_transactions(user_id, created_at desc);
create index if not exists suly_credit_transactions_hold_idx
  on public.suly_credit_transactions(hold_id);
create unique index if not exists suly_credit_transactions_hold_event_uidx
  on public.suly_credit_transactions(hold_id, event_type)
  where hold_id is not null;
create unique index if not exists suly_credit_transactions_request_uidx
  on public.suly_credit_transactions(request_id)
  where request_id is not null;

create table if not exists public.suly_credit_pricing (
  id integer primary key default 1 check (id = 1),
  enabled boolean not null default false,
  minimum_request_credits bigint not null default 10 check (minimum_request_credits >= 0),
  input_credits_per_1k_tokens bigint not null default 0 check (input_credits_per_1k_tokens >= 0),
  output_credits_per_1k_tokens bigint not null default 0 check (output_credits_per_1k_tokens >= 0),
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

insert into public.suly_credit_pricing (id) values (1) on conflict (id) do nothing;

alter table public.suly_credit_accounts enable row level security;
alter table public.suly_credit_holds enable row level security;
alter table public.suly_credit_transactions enable row level security;
alter table public.suly_credit_pricing enable row level security;

drop policy if exists suly_credit_accounts_read_owner_admin on public.suly_credit_accounts;
create policy suly_credit_accounts_read_owner_admin on public.suly_credit_accounts
  for select to authenticated
  using ((select auth.uid()) = user_id or public.suly_is_admin());

drop policy if exists suly_credit_holds_read_owner_admin on public.suly_credit_holds;
create policy suly_credit_holds_read_owner_admin on public.suly_credit_holds
  for select to authenticated
  using ((select auth.uid()) = user_id or public.suly_is_admin());

drop policy if exists suly_credit_transactions_read_owner_admin on public.suly_credit_transactions;
create policy suly_credit_transactions_read_owner_admin on public.suly_credit_transactions
  for select to authenticated
  using ((select auth.uid()) = user_id or public.suly_is_admin());

drop policy if exists suly_credit_pricing_read_admin on public.suly_credit_pricing;
create policy suly_credit_pricing_read_admin on public.suly_credit_pricing
  for select to authenticated
  using (public.suly_is_admin());

revoke all on table public.suly_credit_accounts from anon, authenticated;
revoke all on table public.suly_credit_holds from anon, authenticated;
revoke all on table public.suly_credit_transactions from anon, authenticated;
revoke all on table public.suly_credit_pricing from anon, authenticated;
grant select on table public.suly_credit_accounts to authenticated;
grant select on table public.suly_credit_holds to authenticated;
grant select on table public.suly_credit_transactions to authenticated;
grant select on table public.suly_credit_pricing to authenticated;
grant all on table public.suly_credit_accounts to service_role;
grant all on table public.suly_credit_holds to service_role;
grant all on table public.suly_credit_transactions to service_role;
grant all on table public.suly_credit_pricing to service_role;

create or replace function public.reserve_credits(
  p_user_id uuid,
  p_task_id uuid,
  p_amount bigint,
  p_conversation_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_account public.suly_credit_accounts%rowtype;
  v_hold public.suly_credit_holds%rowtype;
  v_balance bigint;
  v_reserved bigint;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service role required' using errcode = '42501';
  end if;
  if p_user_id is null or p_task_id is null or p_amount is null or p_amount <= 0 or p_amount > 1000000000 then
    raise exception 'invalid reservation parameters' using errcode = '22023';
  end if;

  insert into public.suly_credit_accounts(user_id) values (p_user_id)
  on conflict (user_id) do nothing;
  select * into v_account from public.suly_credit_accounts where user_id = p_user_id for update;

  -- Release abandoned holds after 30 minutes, preserving an auditable ledger.
  for v_hold in
    select * from public.suly_credit_holds
    where user_id = p_user_id and status = 'held' and created_at < now() - interval '30 minutes'
    order by created_at
    for update
  loop
    update public.suly_credit_accounts
      set balance = balance + v_hold.reserved_amount,
          reserved_balance = reserved_balance - v_hold.reserved_amount,
          updated_at = now()
      where user_id = p_user_id
      returning balance, reserved_balance into v_balance, v_reserved;
    update public.suly_credit_holds
      set status = 'expired', charged_amount = 0, actual_cost = 0, settled_at = now()
      where task_id = v_hold.task_id;
    insert into public.suly_credit_transactions(
      user_id, hold_id, event_type, amount, balance_delta, reserved_delta,
      balance_after, reserved_after, source, reason
    ) values (
      p_user_id, v_hold.task_id, 'expire', v_hold.reserved_amount,
      v_hold.reserved_amount, -v_hold.reserved_amount, v_balance, v_reserved,
      'credit_escrow', 'Released stale reservation after timeout'
    ) on conflict do nothing;
  end loop;

  select * into v_account from public.suly_credit_accounts where user_id = p_user_id;

  select * into v_hold from public.suly_credit_holds where task_id = p_task_id for update;
  if found then
    if v_hold.user_id = p_user_id and v_hold.status = 'held' and v_hold.reserved_amount = p_amount then
      return jsonb_build_object('success', true, 'already_reserved', true,
        'task_id', p_task_id, 'reserved', p_amount, 'balance', v_account.balance,
        'reserved_balance', v_account.reserved_balance);
    end if;
    return jsonb_build_object('success', false, 'error', 'task_id_conflict');
  end if;

  if v_account.balance < p_amount then
    return jsonb_build_object('success', false, 'error', 'insufficient_credits',
      'balance', v_account.balance, 'required', p_amount);
  end if;

  update public.suly_credit_accounts
    set balance = balance - p_amount,
        reserved_balance = reserved_balance + p_amount,
        updated_at = now()
    where user_id = p_user_id
    returning balance, reserved_balance into v_balance, v_reserved;

  insert into public.suly_credit_holds(task_id, user_id, conversation_id, reserved_amount)
  values (p_task_id, p_user_id, p_conversation_id, p_amount);
  insert into public.suly_credit_transactions(
    user_id, hold_id, event_type, amount, balance_delta, reserved_delta,
    balance_after, reserved_after, source, reason
  ) values (
    p_user_id, p_task_id, 'reserve', p_amount, -p_amount, p_amount,
    v_balance, v_reserved, 'ai_request', 'Credits reserved before model execution'
  );

  return jsonb_build_object('success', true, 'task_id', p_task_id,
    'reserved', p_amount, 'balance', v_balance, 'reserved_balance', v_reserved);
end;
$$;

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
  if v_hold.status = 'settled' or v_hold.status = 'expired' then
    return jsonb_build_object('success', true, 'already_finalized', true,
      'charged', coalesce(v_hold.charged_amount, 0), 'actual_cost', coalesce(v_hold.actual_cost, 0),
      'balance', v_account.balance, 'reserved_balance', v_account.reserved_balance);
  end if;
  if v_account.reserved_balance < v_hold.reserved_amount then
    raise exception 'reserved balance invariant violated' using errcode = '23514';
  end if;

  -- Never make a wallet negative: top up from spendable balance when possible,
  -- otherwise cap the charge at the total held + available amount.
  v_charge := least(p_actual_cost, v_hold.reserved_amount + v_account.balance);
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
    case when v_charge < p_actual_cost then 'Charge capped by available balance' else null end
  );

  return jsonb_build_object('success', true, 'charged', v_charge,
    'actual_cost', p_actual_cost, 'balance', v_balance, 'reserved_balance', v_reserved,
    'capped', v_charge < p_actual_cost);
end;
$$;

create or replace function public.suly_admin_adjust_credits(
  p_user_id uuid,
  p_amount bigint,
  p_reason text,
  p_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_account public.suly_credit_accounts%rowtype;
  v_existing public.suly_credit_transactions%rowtype;
  v_balance bigint;
  v_admin uuid := auth.uid();
begin
  if v_admin is null or not public.suly_is_admin() then
    raise exception 'administrator privileges required' using errcode = '42501';
  end if;
  if p_user_id is null or p_request_id is null or p_amount = 0
    or p_amount < -1000000000 or p_amount > 1000000000
    or length(trim(coalesce(p_reason, ''))) = 0 or length(p_reason) > 500 then
    raise exception 'invalid credit adjustment' using errcode = '22023';
  end if;

  select * into v_existing from public.suly_credit_transactions where request_id = p_request_id;
  if found then
    if v_existing.user_id <> p_user_id then
      raise exception 'request_id conflict' using errcode = '23505';
    end if;
    return jsonb_build_object('success', true, 'already_applied', true,
      'balance', v_existing.balance_after, 'transaction_id', v_existing.id);
  end if;

  insert into public.suly_credit_accounts(user_id) values (p_user_id) on conflict (user_id) do nothing;
  select * into v_account from public.suly_credit_accounts where user_id = p_user_id for update;
  if v_account.balance + p_amount < 0 then
    return jsonb_build_object('success', false, 'error', 'insufficient_credits', 'balance', v_account.balance);
  end if;
  update public.suly_credit_accounts set balance = balance + p_amount, updated_at = now()
    where user_id = p_user_id returning balance into v_balance;
  insert into public.suly_credit_transactions(
    user_id, request_id, event_type, amount, balance_delta, reserved_delta,
    balance_after, reserved_after, source, reason
  ) values (
    p_user_id, p_request_id, 'admin_adjust', p_amount, p_amount, 0,
    v_balance, v_account.reserved_balance, 'admin', trim(p_reason)
  ) returning * into v_existing;
  insert into public.admin_audit_logs(admin_id, action, target_table, target_id, old_value, new_value, created_at)
  values (v_admin, 'credit_adjustment', 'suly_credit_accounts', p_user_id::text,
    jsonb_build_object('balance', v_account.balance),
    jsonb_build_object('balance', v_balance, 'amount', p_amount, 'reason', trim(p_reason)), now());
  return jsonb_build_object('success', true, 'balance', v_balance, 'transaction_id', v_existing.id);
end;
$$;

create or replace function public.suly_admin_update_credit_pricing(
  p_enabled boolean,
  p_minimum_request_credits bigint,
  p_input_credits_per_1k_tokens bigint,
  p_output_credits_per_1k_tokens bigint
)
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
  if p_minimum_request_credits < 0 or p_input_credits_per_1k_tokens < 0
    or p_output_credits_per_1k_tokens < 0 or p_minimum_request_credits > 1000000000
    or p_input_credits_per_1k_tokens > 1000000000 or p_output_credits_per_1k_tokens > 1000000000 then
    raise exception 'invalid pricing values' using errcode = '22023';
  end if;
  update public.suly_credit_pricing set enabled = p_enabled,
    minimum_request_credits = p_minimum_request_credits,
    input_credits_per_1k_tokens = p_input_credits_per_1k_tokens,
    output_credits_per_1k_tokens = p_output_credits_per_1k_tokens,
    updated_by = v_admin, updated_at = now()
  where id = 1;
  insert into public.admin_audit_logs(admin_id, action, target_table, target_id, new_value, created_at)
  values (v_admin, 'credit_pricing_updated', 'suly_credit_pricing', '1',
    jsonb_build_object('enabled', p_enabled, 'minimum_request_credits', p_minimum_request_credits,
      'input_credits_per_1k_tokens', p_input_credits_per_1k_tokens,
      'output_credits_per_1k_tokens', p_output_credits_per_1k_tokens), now());
  return jsonb_build_object('success', true, 'enabled', p_enabled);
end;
$$;

revoke all on function public.reserve_credits(uuid, uuid, bigint, uuid) from public, anon, authenticated;
revoke all on function public.finalize_credits(uuid, uuid, bigint, integer, integer, integer, text) from public, anon, authenticated;
revoke all on function public.suly_admin_adjust_credits(uuid, bigint, text, uuid) from public, anon, authenticated;
revoke all on function public.suly_admin_update_credit_pricing(boolean, bigint, bigint, bigint) from public, anon, authenticated;
grant execute on function public.reserve_credits(uuid, uuid, bigint, uuid) to service_role;
grant execute on function public.finalize_credits(uuid, uuid, bigint, integer, integer, integer, text) to service_role;
grant execute on function public.suly_admin_adjust_credits(uuid, bigint, text, uuid) to authenticated;
grant execute on function public.suly_admin_update_credit_pricing(boolean, bigint, bigint, bigint) to authenticated;

commit;
