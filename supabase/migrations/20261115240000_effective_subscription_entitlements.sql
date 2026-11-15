-- Effective subscription entitlement resolution. Active subscription records
-- take precedence; expired/replaced subscriptions fall back to Free. Legacy
-- profiles without subscription history retain their current tier.

begin;

create or replace function public.suly_effective_subscription_tier(p_user_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_tier text;
  v_has_history boolean;
begin
  if p_user_id is null then
    raise exception 'user id required' using errcode = '22023';
  end if;
  if coalesce(auth.role(), '') <> 'service_role'
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
  if v_tier in ('free','lite','pro','max') then return v_tier; end if;
  return 'free';
end;
$$;

revoke all on function public.suly_effective_subscription_tier(uuid) from public, anon;
grant execute on function public.suly_effective_subscription_tier(uuid) to authenticated, service_role;

create or replace function public.suly_list_public_image_models()
returns table (
  id uuid,
  display_name text,
  supported_qualities text[],
  is_default boolean,
  prices jsonb
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_tier text;
  v_tier_rank integer;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  v_tier := public.suly_effective_subscription_tier(v_user_id);
  v_tier_rank := coalesce(array_position(array['free','lite','pro','max']::text[], v_tier), 1);

  return query
  select model.id, model.display_name, model.supported_qualities, model.is_default,
    coalesce(jsonb_agg(jsonb_build_object(
      'quality', price.quality, 'price_credits', price.price_credits, 'resolution', price.resolution
    ) order by price.quality) filter (where price.id is not null), '[]'::jsonb) as prices
  from public.suly_media_generation_models model
  left join public.suly_media_generation_prices price
    on price.generation_model_id = model.id and price.enabled = true
  where model.service_type = 'image' and model.is_active = true
    and (public.suly_is_admin() or exists (
      select 1 from unnest(model.allowed_tiers) as allowed_tier
      where array_position(array['free','lite','pro','max']::text[], allowed_tier) <= v_tier_rank
    ))
  group by model.id, model.display_name, model.supported_qualities, model.is_default
  having count(price.id) > 0
  order by model.is_default desc, model.display_name;
end;
$$;

revoke all on function public.suly_list_public_image_models() from public, anon;
grant execute on function public.suly_list_public_image_models() to authenticated;

commit;
