begin;
create or replace function public.suly_admin_save_image_generation_model(
  p_model_id uuid,
  p_provider_id integer,
  p_display_name text,
  p_model_identifier text,
  p_endpoint_url text,
  p_allowed_tiers text[],
  p_is_active boolean,
  p_is_default boolean,
  p_prices jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_admin uuid := auth.uid();
  v_model public.suly_media_generation_models%rowtype;
  v_old_model jsonb := null;
  v_old_prices jsonb := '[]'::jsonb;
  v_new_prices jsonb := '[]'::jsonb;
  v_enabled_qualities text[];
  v_price_count integer;
  v_enabled_count integer;
begin
  if v_admin is null or not public.suly_is_admin() then
    raise exception 'administrator privileges required' using errcode = '42501';
  end if;

  if p_provider_id is null
     or p_display_name is null or length(btrim(p_display_name)) not between 1 and 100
     or p_model_identifier is null or length(btrim(p_model_identifier)) not between 1 and 200
     or p_endpoint_url is null
     or p_endpoint_url !~* '^https://[^/@[:space:]]+(/[^[:space:]]*)?$'
     or p_is_active is null or p_is_default is null
     or coalesce(cardinality(p_allowed_tiers), 0) = 0
     or array_position(p_allowed_tiers, null) is not null
     or not (p_allowed_tiers <@ array['free','lite','pro','max']::text[]) then
    raise exception 'invalid image model configuration' using errcode = '22023';
  end if;

  if p_prices is null or jsonb_typeof(p_prices) <> 'array' then
    raise exception 'price rows must be a JSON array' using errcode = '22023';
  end if;
  if jsonb_array_length(p_prices) <> 4 then
    raise exception 'exactly four quality price rows are required' using errcode = '22023';
  end if;
  if cardinality(p_allowed_tiers) <> (
    select count(distinct allowed.value) from unnest(p_allowed_tiers) as allowed(value)
  ) then
    raise exception 'duplicate subscription tiers are not allowed' using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.ai_providers provider
    where provider.id = p_provider_id and provider.enabled = true
  ) then
    raise exception 'provider is missing or disabled' using errcode = '22023';
  end if;

  if p_is_active and not exists (
    select 1
    from public.suly_media_model_capability_evidence evidence
    where evidence.provider_id = p_provider_id
      and evidence.service_type = 'image'
      and evidence.model_identifier = btrim(p_model_identifier)
      and evidence.capability_key = 'image_generation'
      and evidence.provider_test_status = 'passed'
      and evidence.suly_test_status = 'passed'
  ) then
    raise exception 'image model activation requires successful provider and SULY integration evidence' using errcode = '22023';
  end if;

  if (select count(distinct price.quality)
      from jsonb_to_recordset(p_prices) as price(
        quality text, price_credits bigint, estimated_provider_cost_usd numeric,
        target_margin numeric, credit_value_egp numeric, usd_to_egp numeric,
        resolution text, enabled boolean
      )
      where price.quality in ('economy','standard','high','ultra')) <> 4 then
    raise exception 'exactly one row for each supported quality is required' using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_prices) as price(
      quality text, price_credits bigint, estimated_provider_cost_usd numeric,
      target_margin numeric, credit_value_egp numeric, usd_to_egp numeric,
      resolution text, enabled boolean
    )
    where price.quality not in ('economy','standard','high','ultra')
       or price.price_credits is null or price.price_credits < 1 or price.price_credits > 1000000000
       or price.estimated_provider_cost_usd is null or price.estimated_provider_cost_usd < 0
       or price.target_margin is null or price.target_margin < 0 or price.target_margin >= 1
       or price.credit_value_egp is null or price.credit_value_egp < 0
       or price.usd_to_egp is null or price.usd_to_egp < 0
       or price.resolution is null or length(btrim(price.resolution)) not between 1 and 40
       or price.enabled is null
       or (price.enabled and (
         price.estimated_provider_cost_usd <= 0
         or price.credit_value_egp <= 0
         or price.usd_to_egp <= 0
         or price.price_credits < ceil(
           (price.estimated_provider_cost_usd * price.usd_to_egp)
           / ((1 - price.target_margin) * price.credit_value_egp)
         )
       ))
  ) then
    raise exception 'invalid price row or price below configured provider cost and margin' using errcode = '22023';
  end if;

  select count(*), count(*) filter (where price.enabled)
    into v_price_count, v_enabled_count
  from jsonb_to_recordset(p_prices) as price(
    quality text, price_credits bigint, estimated_provider_cost_usd numeric,
    target_margin numeric, credit_value_egp numeric, usd_to_egp numeric,
    resolution text, enabled boolean
  );
  if v_price_count <> 4 or (p_is_active and v_enabled_count = 0) then
    raise exception 'active image model requires at least one enabled valid price' using errcode = '22023';
  end if;

  select coalesce(array_agg(price.quality order by price.quality), array[]::text[])
    into v_enabled_qualities
  from jsonb_to_recordset(p_prices) as price(
    quality text, price_credits bigint, estimated_provider_cost_usd numeric,
    target_margin numeric, credit_value_egp numeric, usd_to_egp numeric,
    resolution text, enabled boolean
  )
  where price.enabled;

  -- Serialize default selection to prevent concurrent administrators from
  -- racing the unique partial index or clearing each other's chosen default.
  perform pg_advisory_xact_lock(hashtextextended('suly-image-generation-default', 0));

  if p_model_id is not null then
    select * into v_model
    from public.suly_media_generation_models
    where id = p_model_id and service_type = 'image'
    for update;
    if not found then
      raise exception 'image model not found' using errcode = '22023';
    end if;
    v_old_model := to_jsonb(v_model);
    select coalesce(jsonb_agg(to_jsonb(price) order by price.quality), '[]'::jsonb)
      into v_old_prices
    from public.suly_media_generation_prices price
    where price.generation_model_id = p_model_id;
  end if;

  if p_is_default and p_is_active then
    update public.suly_media_generation_models
      set is_default = false, updated_at = now()
    where service_type = 'image' and is_active = true
      and (p_model_id is null or id <> p_model_id) and is_default = true;
  end if;

  if p_model_id is null then
    insert into public.suly_media_generation_models(
      service_type, display_name, provider_id, model_identifier, protocol,
      endpoint_url, allowed_tiers, supported_qualities, capabilities_json,
      is_default, is_active, created_at, updated_at
    ) values (
      'image', btrim(p_display_name), p_provider_id, btrim(p_model_identifier),
      'openai_images', btrim(p_endpoint_url), p_allowed_tiers, v_enabled_qualities,
      jsonb_build_object('text_to_image', true, 'image_to_image', false),
      coalesce(p_is_default and p_is_active, false), coalesce(p_is_active, false), now(), now()
    ) returning * into v_model;
  else
    update public.suly_media_generation_models
    set display_name = btrim(p_display_name),
        provider_id = p_provider_id,
        model_identifier = btrim(p_model_identifier),
        endpoint_url = btrim(p_endpoint_url),
        allowed_tiers = p_allowed_tiers,
        supported_qualities = v_enabled_qualities,
        capabilities_json = jsonb_build_object('text_to_image', true, 'image_to_image', false),
        is_default = coalesce(p_is_default and p_is_active, false),
        is_active = coalesce(p_is_active, false),
        updated_at = now()
    where id = p_model_id
    returning * into v_model;
  end if;

  insert into public.suly_media_generation_prices(
    generation_model_id, quality, price_credits, estimated_provider_cost_usd,
    target_margin, credit_value_egp, usd_to_egp, resolution, unit_type,
    enabled, price_version, updated_by, created_at, updated_at
  )
  select v_model.id, price.quality, price.price_credits,
    price.estimated_provider_cost_usd, price.target_margin,
    price.credit_value_egp, price.usd_to_egp, btrim(price.resolution),
    'image', price.enabled, 1, v_admin, now(), now()
  from jsonb_to_recordset(p_prices) as price(
    quality text, price_credits bigint, estimated_provider_cost_usd numeric,
    target_margin numeric, credit_value_egp numeric, usd_to_egp numeric,
    resolution text, enabled boolean
  )
  on conflict (generation_model_id, quality) do update
  set price_credits = excluded.price_credits,
      estimated_provider_cost_usd = excluded.estimated_provider_cost_usd,
      target_margin = excluded.target_margin,
      credit_value_egp = excluded.credit_value_egp,
      usd_to_egp = excluded.usd_to_egp,
      resolution = excluded.resolution,
      unit_type = 'image',
      enabled = excluded.enabled,
      price_version = public.suly_media_generation_prices.price_version + 1,
      updated_by = v_admin,
      updated_at = now();

  select coalesce(jsonb_agg(to_jsonb(price) order by price.quality), '[]'::jsonb)
    into v_new_prices
  from public.suly_media_generation_prices price
  where price.generation_model_id = v_model.id;

  insert into public.admin_audit_logs(
    admin_id, action, target_table, target_id, old_value, new_value, created_at
  ) values (
    v_admin, 'image_generation_model_saved',
    'suly_media_generation_models', v_model.id::text,
    jsonb_build_object('model', v_old_model, 'prices', v_old_prices),
    jsonb_build_object('model', to_jsonb(v_model), 'prices', v_new_prices),
    now()
  );

  return jsonb_build_object(
    'success', true, 'model_id', v_model.id,
    'service_type', 'image', 'is_active', v_model.is_active,
    'is_default', v_model.is_default, 'supported_qualities', v_model.supported_qualities
  );
end;
$$;
revoke all on function public.suly_admin_save_image_generation_model(uuid,integer,text,text,text,text[],boolean,boolean,jsonb) from public,anon;
grant execute on function public.suly_admin_save_image_generation_model(uuid,integer,text,text,text,text[],boolean,boolean,jsonb) to authenticated;
commit;