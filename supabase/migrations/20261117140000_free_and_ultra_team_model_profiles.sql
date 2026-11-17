begin;

-- Separate the Free model profile from the paid Lite subscription.
-- Add Ultra Team as a recognized tier, but keep its profile inactive until
-- team entitlements, membership, billing and model policies are complete.

alter table public.subscription_plans
  drop constraint if exists subscription_plans_tier_key_check;
alter table public.subscription_plans
  add constraint subscription_plans_tier_key_check
  check (tier_key in ('free','lite','pro','max','ultra_team'));

alter table public.suly_user_subscriptions
  drop constraint if exists suly_user_subscriptions_tier_key_check;
alter table public.suly_user_subscriptions
  add constraint suly_user_subscriptions_tier_key_check
  check (tier_key in ('free','lite','pro','max','ultra_team'));

alter table public.suly_profiles
  drop constraint if exists suly_profiles_subscription_tier_check;
alter table public.suly_profiles
  add constraint suly_profiles_subscription_tier_check
  check (subscription_tier in ('free','lite','pro','max','ultra_team'));

-- Extend the tier arrays used by the authoritative text and media routers.
alter table public.ai_models
  drop constraint if exists ai_models_allowed_tiers_check;
alter table public.ai_models
  add constraint ai_models_allowed_tiers_check
  check (allowed_tiers <@ ARRAY['free','lite','pro','max','ultra_team']::text[]);

alter table public.suly_media_generation_models
  drop constraint if exists suly_media_generation_models_allowed_tiers_check;
alter table public.suly_media_generation_models
  add constraint suly_media_generation_models_allowed_tiers_check
  check (allowed_tiers <@ ARRAY['free','lite','pro','max','ultra_team']::text[]);

-- Media models are currently inactive and have no approved Free trial policy.
-- Keep them paid-only until the owner configures a specific welcome image allowance.
update public.suly_media_generation_models
set allowed_tiers = ARRAY['max']::text[], updated_at = now()
where is_active = false;

-- Catalog discovery previously defaulted every disabled model to all tiers.
-- Remove accidental Free eligibility from every model outside the Free race.
update public.ai_models
set allowed_tiers = case
  when cardinality(array_remove(allowed_tiers, 'free')) = 0 then ARRAY['max']::text[]
  else array_remove(allowed_tiers, 'free')
end
where routing_group <> 'free_race'
  and 'free' = any(allowed_tiers);

alter table public.ai_models
  drop constraint if exists ai_models_free_tier_requires_free_race_check;
alter table public.ai_models
  add constraint ai_models_free_tier_requires_free_race_check
  check (not ('free' = any(allowed_tiers)) or routing_group = 'free_race');

alter table public.suly_model_profiles
  drop constraint if exists suly_model_profiles_profile_key_check;
alter table public.suly_model_profiles
  add constraint suly_model_profiles_profile_key_check
  check (profile_key in ('free','lite','pro','max','ultra_team'));

alter table public.suly_model_profiles
  drop constraint if exists suly_model_profiles_minimum_subscription_tier_check;
alter table public.suly_model_profiles
  add constraint suly_model_profiles_minimum_subscription_tier_check
  check (minimum_subscription_tier in ('free','lite','pro','max','ultra_team'));

-- Free receives its own profile with the existing lightweight capabilities.
insert into public.suly_model_profiles
  (profile_key,display_name,tagline,description,icon_key,sort_order,minimum_subscription_tier,capabilities_json,is_active)
select
  'free','SULY Free','للتجربة والاستخدام الخفيف',
  'مستوى مجاني محدود يستخدم نماذج Free فقط ولا يمنح البحث أو المهام متعددة الخطوات المتقدمة.',
  'sparkles',0,'free',capabilities_json,true
from public.suly_model_profiles
where profile_key='lite'
on conflict (profile_key) do nothing;

-- Paid Lite now requires a Lite subscription; Free no longer inherits Lite.
update public.suly_model_profiles
set minimum_subscription_tier='lite',updated_at=now()
where profile_key='lite' and minimum_subscription_tier='free';

-- Preserve the existing Max profile entitlement: Pro and higher plans may select the Max profile.

-- Prepare Ultra Team in a fail-closed state. Do not sell or enable it until
-- team membership, team wallet, shared projects and billing are implemented.
insert into public.suly_model_profiles
  (profile_key,display_name,tagline,description,icon_key,sort_order,minimum_subscription_tier,capabilities_json,is_active)
select
  'ultra_team','SULY Ultra Team','مساحة عمل للفرق',
  'ملف مستوى الفريق محجوز للتفعيل بعد اكتمال العضويات والصلاحيات والرصيد المشترك.',
  'people',4,'ultra_team',capabilities_json,false
from public.suly_model_profiles
where profile_key='max'
on conflict (profile_key) do nothing;

create or replace function public.suly_effective_subscription_tier(p_user_id uuid)
returns text
language plpgsql
stable
security definer
set search_path to 'pg_catalog', 'public', 'pg_temp'
as $function$
declare
  v_tier text;
  v_has_history boolean;
begin
  if p_user_id is null then
    raise exception 'user id required' using errcode = '22023';
  end if;
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role'
    and auth.uid() is distinct from p_user_id
    and not public.suly_is_admin() then
    raise exception 'not authorized to read subscription entitlement' using errcode = '42501';
  end if;

  select tier_key into v_tier
  from public.suly_user_subscriptions
  where user_id = p_user_id and status = 'active'
    and (expires_at is null or expires_at > now())
  order by starts_at desc, created_at desc
  limit 1;
  if found then return v_tier; end if;

  select exists(select 1 from public.suly_user_subscriptions where user_id = p_user_id)
    into v_has_history;
  if v_has_history then return 'free'; end if;

  select subscription_tier into v_tier
  from public.suly_profiles where id = p_user_id;
  if v_tier in ('free','lite','pro','max','ultra_team') then return v_tier; end if;
  return 'free';
end;
$function$;


-- Keep daily-credit and legacy Brain quotas aligned with the effective tier.
create or replace function public.suly_claim_daily_credits(p_user_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'auth', 'pg_temp'
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
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role'
    and auth.uid() is distinct from v_user_id
    and not public.suly_is_admin() then
    raise exception 'not authorized to claim daily credits for this user' using errcode = '42501';
  end if;

  select is_banned into v_banned
  from public.suly_profiles where id = v_user_id;
  if not found or coalesce(v_banned, true) then
    return jsonb_build_object('success', false, 'error', 'account_inactive');
  end if;

  v_tier := public.suly_effective_subscription_tier(v_user_id);
  if v_tier not in ('free','lite','pro','max','ultra_team') then
    v_tier := 'free';
  end if;

  select daily_credits into v_daily
  from public.subscription_plans
  where tier_key = v_tier and is_active = true
  order by id desc limit 1;
  if not found then
    return jsonb_build_object('success', false, 'error', 'active_plan_not_found');
  end if;
  if coalesce(v_daily, 0) <= 0 then
    return jsonb_build_object(
      'success', true, 'granted', 0, 'already_claimed', false,
      'reason', 'no_daily_allowance', 'tier_key', v_tier, 'grant_date', v_grant_date
    );
  end if;

  insert into public.suly_credit_accounts(user_id)
  values (v_user_id) on conflict (user_id) do nothing;

  select balance, reserved_balance into v_balance, v_reserved
  from public.suly_credit_accounts where user_id = v_user_id for update;

  select * into v_existing
  from public.suly_daily_credit_grants
  where user_id = v_user_id and grant_date = v_grant_date for update;

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
    set tier_key = v_tier, granted_credits = v_daily, updated_at = now()
    where id = v_existing.id;
  end if;

  update public.suly_credit_accounts
  set balance = balance + v_delta, updated_at = now()
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
    'grant_date', v_grant_date, 'balance', v_balance, 'reserved_balance', v_reserved
  );
end;
$function$;

create or replace function public.brain_reserve_usage(p_user_id uuid, p_task_id uuid, p_tokens integer)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'auth'
as $function$
declare
  v_plan public.plans%rowtype;
  v_usage public.brain_usage_daily%rowtype;
  v_event public.brain_usage_events%rowtype;
  v_tier text;
  v_date date := current_date;
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    raise exception 'service role required' using errcode = '42501';
  end if;
  if p_user_id is null or p_task_id is null or p_tokens is null or p_tokens < 1 or p_tokens > 100000000 then
    raise exception 'invalid usage reservation' using errcode = '22023';
  end if;
  select * into v_event from public.brain_usage_events where task_id = p_task_id for update;
  if found then
    if v_event.user_id <> p_user_id then
      return jsonb_build_object('allowed', false, 'error', 'task_id_conflict');
    end if;
    if v_event.status = 'completed' then
      return jsonb_build_object('allowed', true, 'already_completed', true,
        'actual_tokens', v_event.actual_tokens, 'status', v_event.status);
    end if;
    if v_event.status = 'reserved' then
      return jsonb_build_object('allowed', false, 'error', 'task_in_progress',
        'reserved_tokens', v_event.reserved_tokens);
    end if;
    return jsonb_build_object('allowed', false, 'error', 'task_failed', 'status', v_event.status);
  end if;

  v_tier := public.suly_effective_subscription_tier(p_user_id);
  select * into v_plan from public.plans
  where name = case
    when v_tier = 'pro' then 'pro'
    when v_tier in ('max','ultra','ultra_team') then 'max'
    else 'free'
  end
  limit 1;
  if not found then raise exception 'brain plan is not configured' using errcode = '55000'; end if;

  insert into public.brain_usage_daily(user_id, usage_date)
  values (p_user_id, v_date) on conflict do nothing;
  select * into v_usage from public.brain_usage_daily
  where user_id = p_user_id and usage_date = v_date for update;
  if v_usage.tasks_used >= v_plan.daily_tasks_limit then
    return jsonb_build_object('allowed', false, 'error', 'daily_tasks_limit');
  end if;
  if v_usage.tokens_used + v_usage.tokens_reserved + p_tokens > v_plan.daily_tokens_limit then
    return jsonb_build_object('allowed', false, 'error', 'daily_tokens_limit');
  end if;
  update public.brain_usage_daily
  set tasks_used = tasks_used + 1, tokens_reserved = tokens_reserved + p_tokens
  where user_id = p_user_id and usage_date = v_date;
  insert into public.brain_usage_events(task_id, user_id, usage_date, reserved_tokens)
  values (p_task_id, p_user_id, v_date, p_tokens);
  return jsonb_build_object('allowed', true, 'already_reserved', false,
    'reserved_tokens', p_tokens, 'plan', v_plan.name,
    'daily_tokens_limit', v_plan.daily_tokens_limit);
end;
$function$;

commit;
