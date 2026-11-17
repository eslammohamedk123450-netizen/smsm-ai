-- Make both Pro and Max selectable from the Pro subscription tier.
-- X remains visible in the client but unavailable until its provider/model is approved.
begin;

update public.suly_model_profiles
set minimum_subscription_tier = 'pro',
    updated_at = now()
where profile_key = 'max'
  and minimum_subscription_tier <> 'pro';

-- Models assigned to the Max profile must also be eligible for Pro subscribers,
-- otherwise the profile would be selectable in the UI but have no routable model.
update public.ai_models model
set allowed_tiers = array(
  select distinct tier
  from unnest(coalesce(model.allowed_tiers, array[]::text[]) || array['pro']::text[]) as tier
  order by tier
)
where 'max' = any(coalesce(model.allowed_tiers, array[]::text[]))
  and exists (
    select 1
    from public.suly_model_profile_models assignment
    where assignment.model_id = model.id
      and assignment.profile_key = 'max'
      and assignment.enabled = true
  );

commit;
