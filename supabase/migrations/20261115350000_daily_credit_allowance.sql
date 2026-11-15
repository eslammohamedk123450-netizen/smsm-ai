-- Grant each account its configured daily SULY Credit allowance once per Cairo-local day.
begin;

create table if not exists public.suly_daily_credit_grants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  grant_date date not null,
  tier_key text not null,
  granted_credits bigint not null check (granted_credits >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint suly_daily_credit_grants_user_date_unique unique (user_id, grant_date)
);

create index if not exists suly_daily_credit_grants_date_idx
  on public.suly_daily_credit_grants(grant_date desc);

alter table public.suly_daily_credit_grants enable row level security;
revoke all on public.suly_daily_credit_grants from anon, authenticated;
grant select on public.suly_daily_credit_grants to authenticated;

drop policy if exists suly_daily_credit_grants_owner_read on public.suly_daily_credit_grants;
create policy suly_daily_credit_grants_owner_read
  on public.suly_daily_credit_grants
  for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists suly_daily_credit_grants_admin_read on public.suly_daily_credit_grants;
create policy suly_daily_credit_grants_admin_read
  on public.suly_daily_credit_grants
  for select to authenticated
  using (public.suly_is_admin());

alter table public.suly_credit_transactions
  drop constraint if exists suly_credit_transactions_event_type_check;
alter table public.suly_credit_transactions
  add constraint suly_credit_transactions_event_type_check
  check (event_type = any (array['reserve','settle','expire','admin_adjust','daily_grant']::text[]));

-- Free tier: 300 daily credits, aligned to a 30-day display allowance.
update public.subscription_plans
set daily_credits = 300,
    monthly_credits = 9000,
    updated_at = now()
where id = 1 and tier_key = 'free';

create or replace function public.suly_claim_daily_credits(p_user_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path to pg_catalog, public, auth, pg_temp
as $function$
declare
  v_user_id uuid := coalesce(p_user_id, auth.uid());
  v_tier text;
  v_daily bigint;
  v_grant_date date := (now() at time zone 'Africa/Cairo')::date;
  v_existing public.suly_daily_credit_grants%rowtype;
  v_balance bigint;
  v_reserved bigint;
  v_delta bigint;
  v_banned boolean;
begin
  if v_user_id is null then
    raise exception 'user_id is required' using errcode = '22023';
  end if;
  if coalesce(auth.role(), '') <> 'service_role'
    and auth.uid() is distinct from v_user_id
    and not public.suly_is_admin() then
    raise exception 'not authorized to claim daily credits for this user' using errcode = '42501';
  end if;

  select is_banned into v_banned
  from public.suly_profiles
  where id = v_user_id;
  if not found or coalesce(v_banned, true) then
    return jsonb_build_object('success', false, 'error', 'account_inactive');
  end if;

  v_tier := public.suly_effective_subscription_tier(v_user_id);
  if v_tier not in ('free','lite','pro','max') then
    v_tier := 'free';
  end if;

  select daily_credits into v_daily
  from public.subscription_plans
  where tier_key = v_tier and is_active = true
  order by id desc
  limit 1;
  if not found then
    return jsonb_build_object('success', false, 'error', 'active_plan_not_found');
  end if;
  if coalesce(v_daily, 0) <= 0 then
    return jsonb_build_object(
      'success', true, 'granted', 0, 'already_claimed', false,
      'reason', 'no_daily_allowance', 'tier_key', v_tier,
      'grant_date', v_grant_date
    );
  end if;

  insert into public.suly_credit_accounts(user_id)
  values (v_user_id)
  on conflict (user_id) do nothing;

  select balance, reserved_balance
  into v_balance, v_reserved
  from public.suly_credit_accounts
  where user_id = v_user_id
  for update;

  select * into v_existing
  from public.suly_daily_credit_grants
  where user_id = v_user_id and grant_date = v_grant_date
  for update;

  if not found then
    insert into public.suly_daily_credit_grants(user_id, grant_date, tier_key, granted_credits)
    values (v_user_id, v_grant_date, v_tier, v_daily);
    v_delta := v_daily;
  else
    v_delta := greatest(v_daily - v_existing.granted_credits, 0);
    if v_delta <= 0 then
      return jsonb_build_object(
        'success', true, 'already_claimed', true, 'granted', 0,
        'total_daily_allowance', v_existing.granted_credits,
        'tier_key', v_existing.tier_key, 'grant_date', v_grant_date,
        'balance', v_balance, 'reserved_balance', v_reserved
      );
    end if;
    update public.suly_daily_credit_grants
    set tier_key = v_tier,
        granted_credits = v_daily,
        updated_at = now()
    where id = v_existing.id;
  end if;

  update public.suly_credit_accounts
  set balance = balance + v_delta,
      updated_at = now()
  where user_id = v_user_id
  returning balance, reserved_balance into v_balance, v_reserved;

  insert into public.suly_credit_transactions(
    user_id, event_type, amount, balance_delta, reserved_delta,
    balance_after, reserved_after, source, reason
  ) values (
    v_user_id, 'daily_grant', v_delta, v_delta, 0,
    v_balance, v_reserved, 'daily_allowance',
    'Daily allowance for ' || v_tier || ' on ' || v_grant_date::text
  );

  return jsonb_build_object(
    'success', true, 'already_claimed', false, 'granted', v_delta,
    'total_daily_allowance', v_daily, 'tier_key', v_tier,
    'grant_date', v_grant_date, 'balance', v_balance,
    'reserved_balance', v_reserved
  );
end;
$function$;

revoke all on function public.suly_claim_daily_credits(uuid) from public, anon;
grant execute on function public.suly_claim_daily_credits(uuid) to authenticated, service_role;

-- The AI Router already calls this service-role RPC before reserve_credits.
-- Use that existing gate to grant the daily allowance without changing the router bundle.
create or replace function public.suly_check_ai_rate_limit(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to pg_catalog, public, auth, pg_temp
as $function$
declare
  v_balance bigint;
  v_grant jsonb;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service role required' using errcode = '42501';
  end if;
  if p_user_id is null then
    raise exception 'user_id is required' using errcode = '22023';
  end if;

  v_grant := public.suly_claim_daily_credits(p_user_id);
  if coalesce((v_grant->>'success')::boolean, false) is not true then
    return jsonb_build_object(
      'allowed', false,
      'reason', 'daily_credit_grant_failed',
      'daily_grant_error', coalesce(v_grant->>'error', 'unknown')
    );
  end if;

  select balance into v_balance
  from public.suly_credit_accounts
  where user_id = p_user_id
  limit 1;

  return jsonb_build_object(
    'allowed', true,
    'reason', case when coalesce(v_balance, 0) > 0
      then 'credit_balance'
      else 'credit_gate_delegated_to_reserve' end,
    'daily_grant', v_grant
  );
end;
$function$;

revoke all on function public.suly_check_ai_rate_limit(uuid) from public, anon, authenticated;
grant execute on function public.suly_check_ai_rate_limit(uuid) to service_role;

commit;
