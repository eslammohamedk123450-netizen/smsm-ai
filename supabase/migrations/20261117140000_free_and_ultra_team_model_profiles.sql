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

commit;
