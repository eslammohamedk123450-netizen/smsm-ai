-- Migration 033: keep the database tier constraints in sync with the Ultra plan.
begin;

alter table public.suly_profiles drop constraint if exists suly_profiles_subscription_tier_check;
alter table public.suly_profiles add constraint suly_profiles_subscription_tier_check
  check (subscription_tier = any (array['free'::text, 'lite'::text, 'pro'::text, 'max'::text, 'ultra'::text]));

alter table public.ai_models drop constraint if exists ai_models_allowed_tiers_check;
alter table public.ai_models add constraint ai_models_allowed_tiers_check
  check (allowed_tiers <@ array['free'::text, 'lite'::text, 'pro'::text, 'max'::text, 'ultra'::text]);
alter table public.ai_models alter column allowed_tiers set default
  array['free'::text, 'lite'::text, 'pro'::text, 'max'::text, 'ultra'::text];

commit;
