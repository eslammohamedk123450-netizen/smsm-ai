-- Make both Pro and Max selectable from the Pro subscription tier.
-- X remains visible in the client but unavailable until its provider/model is approved.
begin;

update public.suly_model_profiles
set minimum_subscription_tier = 'pro',
    updated_at = now()
where profile_key = 'max'
  and minimum_subscription_tier <> 'pro';

commit;
