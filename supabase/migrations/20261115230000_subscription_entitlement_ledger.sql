-- Subscription entitlement history. Payment adapters call the service RPC only
-- after independently verifying a successful payment; no gateway is assumed here.

begin;

create table if not exists public.suly_user_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_id integer references public.subscription_plans(id) on delete set null,
  plan_name text not null,
  tier_key text not null check (tier_key in ('free','lite','pro','max')),
  price_amount numeric(20,8) not null default 0 check (price_amount >= 0),
  currency text not null default 'EGP',
  billing_period text not null default 'monthly',
  status text not null default 'pending' check (status in ('pending','active','expired','cancelled','replaced','refunded')),
  payment_provider text,
  payment_reference text,
  starts_at timestamptz not null default now(),
  expires_at timestamptz,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists suly_user_subscriptions_one_active_idx
  on public.suly_user_subscriptions(user_id) where status = 'active';
create unique index if not exists suly_user_subscriptions_payment_reference_idx
  on public.suly_user_subscriptions(payment_provider, payment_reference)
  where payment_provider is not null and payment_reference is not null;
create index if not exists suly_user_subscriptions_user_history_idx
  on public.suly_user_subscriptions(user_id, created_at desc);
create index if not exists suly_user_subscriptions_expiry_idx
  on public.suly_user_subscriptions(expires_at) where status = 'active' and expires_at is not null;

alter table public.suly_user_subscriptions enable row level security;
drop policy if exists suly_user_subscriptions_owner_read on public.suly_user_subscriptions;
create policy suly_user_subscriptions_owner_read on public.suly_user_subscriptions
  for select to authenticated using (user_id = auth.uid() or public.suly_is_admin());

revoke all on public.suly_user_subscriptions from public, anon, authenticated;
grant select on public.suly_user_subscriptions to authenticated;
grant all on public.suly_user_subscriptions to service_role;

create or replace function public.suly_service_activate_subscription(
  p_user_id uuid,
  p_plan_id integer,
  p_payment_provider text,
  p_payment_reference text,
  p_expires_at timestamptz default null,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_plan public.subscription_plans%rowtype;
  v_existing public.suly_user_subscriptions%rowtype;
  v_subscription_id uuid;
  v_tier text;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service role required' using errcode = '42501';
  end if;
  if p_user_id is null or p_plan_id is null
    or length(btrim(coalesce(p_payment_provider,''))) not between 1 and 80
    or length(btrim(coalesce(p_payment_reference,''))) not between 1 and 200
    or (p_expires_at is not null and p_expires_at <= now()) then
    raise exception 'invalid subscription activation parameters' using errcode = '22023';
  end if;

  select * into v_plan from public.subscription_plans
  where id = p_plan_id and is_active = true for share;
  if not found or v_plan.tier_key not in ('lite','pro','max') then
    raise exception 'subscription plan is not available for purchase' using errcode = '22023';
  end if;
  v_tier := v_plan.tier_key;

  select * into v_existing from public.suly_user_subscriptions
  where payment_provider = p_payment_provider and payment_reference = p_payment_reference;
  if found then
    if v_existing.user_id <> p_user_id or v_existing.plan_id <> p_plan_id then
      raise exception 'payment reference conflict' using errcode = '23505';
    end if;
    return jsonb_build_object('success', true, 'already_activated', true,
      'subscription_id', v_existing.id, 'tier_key', v_existing.tier_key);
  end if;

  update public.suly_user_subscriptions
    set status = 'replaced', updated_at = now()
    where user_id = p_user_id and status = 'active';

  insert into public.suly_user_subscriptions(
    user_id,plan_id,plan_name,tier_key,price_amount,currency,billing_period,
    status,payment_provider,payment_reference,starts_at,expires_at,metadata
  ) values (
    p_user_id,v_plan.id,v_plan.name,v_tier,v_plan.price,v_plan.currency,v_plan.billing_period,
    'active',p_payment_provider,p_payment_reference,now(),p_expires_at,coalesce(p_metadata,'{}'::jsonb)
  ) returning id into v_subscription_id;

  update public.suly_profiles set subscription_tier = v_tier where id = p_user_id;
  if not found then raise exception 'user profile not found' using errcode = '23503'; end if;

  return jsonb_build_object('success', true, 'subscription_id', v_subscription_id, 'tier_key', v_tier);
end;
$$;

revoke all on function public.suly_service_activate_subscription(uuid,integer,text,text,timestamptz,jsonb) from public, anon, authenticated;
grant execute on function public.suly_service_activate_subscription(uuid,integer,text,text,timestamptz,jsonb) to service_role;

create or replace function public.suly_admin_grant_subscription(
  p_user_id uuid,
  p_plan_id integer,
  p_expires_at timestamptz,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_admin uuid := auth.uid();
  v_plan public.subscription_plans%rowtype;
  v_subscription_id uuid;
  v_tier text;
begin
  if v_admin is null or not public.suly_is_admin() then
    raise exception 'administrator privileges required' using errcode = '42501';
  end if;
  if p_user_id is null or p_plan_id is null
    or length(btrim(coalesce(p_reason,''))) not between 1 and 500
    or (p_expires_at is not null and p_expires_at <= now()) then
    raise exception 'invalid admin subscription grant' using errcode = '22023';
  end if;
  select * into v_plan from public.subscription_plans where id = p_plan_id and is_active = true;
  if not found or v_plan.tier_key not in ('free','lite','pro','max') then
    raise exception 'subscription plan is not active' using errcode = '22023';
  end if;
  v_tier := v_plan.tier_key;
  update public.suly_user_subscriptions set status = 'replaced', updated_at = now()
    where user_id = p_user_id and status = 'active';
  insert into public.suly_user_subscriptions(
    user_id,plan_id,plan_name,tier_key,price_amount,currency,billing_period,status,
    payment_provider,payment_reference,starts_at,expires_at,metadata
  ) values (
    p_user_id,v_plan.id,v_plan.name,v_tier,v_plan.price,v_plan.currency,v_plan.billing_period,'active',
    'admin',gen_random_uuid()::text,now(),p_expires_at,jsonb_build_object('reason',p_reason,'granted_by',v_admin)
  ) returning id into v_subscription_id;
  update public.suly_profiles set subscription_tier = v_tier where id = p_user_id;
  if not found then raise exception 'user profile not found' using errcode = '23503'; end if;
  insert into public.admin_audit_logs(admin_id,action,target_table,target_id,new_value,created_at)
  values (v_admin,'subscription_granted','suly_user_subscriptions',v_subscription_id::text,
    jsonb_build_object('user_id',p_user_id,'plan_id',p_plan_id,'tier_key',v_tier,'expires_at',p_expires_at,'reason',p_reason),now());
  return jsonb_build_object('success',true,'subscription_id',v_subscription_id,'tier_key',v_tier);
end;
$$;

revoke all on function public.suly_admin_grant_subscription(uuid,integer,timestamptz,text) from public, anon;
grant execute on function public.suly_admin_grant_subscription(uuid,integer,timestamptz,text) to authenticated;

commit;
