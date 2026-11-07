begin;

insert into public.system_settings (key, value, is_sensitive)
values
  ('admob_rewarded_unit_id', '', false),
  ('admob_banner_unit_id', '', false)
on conflict (key) do nothing;

-- Ad placement identifiers are public client configuration, unlike provider secrets.
drop policy if exists "Authenticated can read public ad settings" on public.system_settings;
create policy "Authenticated can read public ad settings"
  on public.system_settings
  for select to authenticated
  using (key in ('admob_app_id', 'admob_rewarded_unit_id', 'admob_banner_unit_id') and is_sensitive = false);
grant select on table public.system_settings to authenticated;

create table if not exists public.suly_rewarded_ad_claims (
  reward_id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  credits bigint not null default 1000 check (credits = 1000),
  claimed_at timestamptz not null default now()
);
create index if not exists suly_rewarded_ad_claims_user_time_idx
  on public.suly_rewarded_ad_claims(user_id, claimed_at desc);

alter table public.suly_rewarded_ad_claims enable row level security;
revoke all on table public.suly_rewarded_ad_claims from anon, authenticated;
grant all on table public.suly_rewarded_ad_claims to service_role;

create or replace function public.claim_rewarded_ad(
  p_reward_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_existing public.suly_rewarded_ad_claims%rowtype;
  v_account public.suly_credit_accounts%rowtype;
  v_balance bigint;
  v_claims_today integer;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if p_reward_id is null then
    raise exception 'reward id required' using errcode = '22023';
  end if;

  -- Serialize claims per user so a double tap cannot bypass the daily guard.
  perform pg_advisory_xact_lock(hashtextextended(v_user_id::text, 0));

  select * into v_existing
  from public.suly_rewarded_ad_claims
  where reward_id = p_reward_id;
  if found then
    if v_existing.user_id <> v_user_id then
      raise exception 'reward id conflict' using errcode = '23505';
    end if;
    select balance into v_balance from public.suly_credit_accounts where user_id = v_user_id;
    return jsonb_build_object('success', true, 'already_claimed', true, 'credits', v_existing.credits, 'balance', coalesce(v_balance, 0));
  end if;

  select count(*)::integer into v_claims_today
  from public.suly_rewarded_ad_claims
  where user_id = v_user_id and claimed_at >= now() - interval '24 hours';
  if v_claims_today >= 3 then
    return jsonb_build_object('success', false, 'error', 'daily_reward_limit');
  end if;

  insert into public.suly_credit_accounts(user_id) values (v_user_id)
  on conflict (user_id) do nothing;
  select * into v_account from public.suly_credit_accounts where user_id = v_user_id for update;

  insert into public.suly_rewarded_ad_claims(reward_id, user_id, credits)
  values (p_reward_id, v_user_id, 1000);
  update public.suly_credit_accounts
    set balance = balance + 1000, updated_at = now()
    where user_id = v_user_id
    returning balance into v_balance;
  insert into public.suly_credit_transactions(
    user_id, request_id, event_type, amount, balance_delta, reserved_delta,
    balance_after, reserved_after, source, reason
  ) values (
    v_user_id, p_reward_id, 'admin_adjust', 1000, 1000, 0,
    v_balance, v_account.reserved_balance, 'rewarded_ad', 'Completed rewarded advertisement'
  );

  return jsonb_build_object('success', true, 'already_claimed', false, 'credits', 1000, 'balance', v_balance);
end;
$$;

revoke all on function public.claim_rewarded_ad(uuid) from public, anon;
grant execute on function public.claim_rewarded_ad(uuid) to authenticated;

commit;
