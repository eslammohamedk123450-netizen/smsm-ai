-- Atomic media admin-save RPC regression.
-- All fixture writes are rolled back; no production model is activated.
begin;

select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', gen_random_uuid()::text, true);
select set_config(
  'suly_test_provider_id',
  (select id::text from public.ai_providers where enabled = true order by id limit 1),
  true
);
select set_config(
  'suly_test_admin_id',
  (select user_id::text from public.suly_admins order by created_at limit 1),
  true
);

set local role authenticated;

do $$
declare
  v_result jsonb;
  v_denied boolean := false;
  v_model_id uuid;
  v_provider_id integer := current_setting('suly_test_provider_id')::integer;
begin
  if has_table_privilege(current_user, 'public.suly_media_generation_models', 'insert')
     or has_table_privilege(current_user, 'public.suly_media_generation_models', 'update')
     or has_table_privilege(current_user, 'public.suly_media_generation_prices', 'insert')
     or has_table_privilege(current_user, 'public.suly_media_generation_prices', 'update') then
    raise exception 'authenticated role must not write media runtime tables directly';
  end if;

  if not has_function_privilege(current_user,
    'public.suly_admin_save_image_generation_model(uuid,integer,text,text,text,text[],boolean,boolean,jsonb)',
    'execute') then
    raise exception 'authenticated role must have execute on the guarded admin save RPC';
  end if;

  begin
    perform public.suly_admin_save_image_generation_model(
      null, v_provider_id, 'Unauthorized fixture', 'unauthorized-fixture',
      'https://example.invalid/v1/images', array['free']::text[], false, false,
      jsonb_build_array(
        jsonb_build_object('quality','economy','price_credits',10,'estimated_provider_cost_usd',0,'target_margin',0.3,'credit_value_egp',0,'usd_to_egp',0,'resolution','1024x1024','enabled',false),
        jsonb_build_object('quality','standard','price_credits',10,'estimated_provider_cost_usd',0,'target_margin',0.3,'credit_value_egp',0,'usd_to_egp',0,'resolution','1024x1024','enabled',false),
        jsonb_build_object('quality','high','price_credits',10,'estimated_provider_cost_usd',0,'target_margin',0.3,'credit_value_egp',0,'usd_to_egp',0,'resolution','1024x1024','enabled',false),
        jsonb_build_object('quality','ultra','price_credits',10,'estimated_provider_cost_usd',0,'target_margin',0.3,'credit_value_egp',0,'usd_to_egp',0,'resolution','1024x1024','enabled',false)
      )
    );
  exception when insufficient_privilege then
    v_denied := true;
  end;
  if not v_denied then
    raise exception 'non-admin user unexpectedly saved a media model';
  end if;

  perform set_config('request.jwt.claim.sub', current_setting('suly_test_admin_id'), true);

  v_result := public.suly_admin_save_image_generation_model(
    null, v_provider_id, 'Rollback test image model', 'suly-atomic-save-regression',
    'https://example.invalid/v1/images', array['free']::text[], false, false,
    jsonb_build_array(
      jsonb_build_object('quality','economy','price_credits',10,'estimated_provider_cost_usd',0,'target_margin',0.3,'credit_value_egp',0,'usd_to_egp',0,'resolution','1024x1024','enabled',false),
      jsonb_build_object('quality','standard','price_credits',10,'estimated_provider_cost_usd',0,'target_margin',0.3,'credit_value_egp',0,'usd_to_egp',0,'resolution','1024x1024','enabled',false),
      jsonb_build_object('quality','high','price_credits',10,'estimated_provider_cost_usd',0,'target_margin',0.3,'credit_value_egp',0,'usd_to_egp',0,'resolution','1024x1024','enabled',false),
      jsonb_build_object('quality','ultra','price_credits',10,'estimated_provider_cost_usd',0,'target_margin',0.3,'credit_value_egp',0,'usd_to_egp',0,'resolution','1024x1024','enabled',false)
    )
  );
  if v_result->>'success' <> 'true' then
    raise exception 'admin save RPC did not return success';
  end if;
  v_model_id := (v_result->>'model_id')::uuid;

  if not exists (
    select 1 from public.suly_media_generation_models
    where id = v_model_id and service_type = 'image' and is_active = false and is_default = false
  ) then
    raise exception 'expected inactive, non-default image model fixture was not created';
  end if;
  if (select count(*) from public.suly_media_generation_prices where generation_model_id = v_model_id) <> 4 then
    raise exception 'expected all four quality rows to be committed atomically';
  end if;
  if not exists (
    select 1 from public.admin_audit_logs
    where action = 'image_generation_model_saved'
      and target_table = 'suly_media_generation_models'
      and target_id = v_model_id::text
  ) then
    raise exception 'admin audit event missing for image model save';
  end if;

  -- A valid shape with an enabled price but missing credit/FX conversion must
  -- be rejected; this protects the current zero-config billing state.
  v_denied := false;
  begin
    perform public.suly_admin_save_image_generation_model(
      v_model_id, v_provider_id, 'Rollback test image model', 'suly-atomic-save-regression',
      'https://example.invalid/v1/images', array['free']::text[], true, true,
      jsonb_build_array(
        jsonb_build_object('quality','economy','price_credits',10,'estimated_provider_cost_usd',1,'target_margin',0.3,'credit_value_egp',0,'usd_to_egp',0,'resolution','1024x1024','enabled',true),
        jsonb_build_object('quality','standard','price_credits',10,'estimated_provider_cost_usd',0,'target_margin',0.3,'credit_value_egp',0,'usd_to_egp',0,'resolution','1024x1024','enabled',false),
        jsonb_build_object('quality','high','price_credits',10,'estimated_provider_cost_usd',0,'target_margin',0.3,'credit_value_egp',0,'usd_to_egp',0,'resolution','1024x1024','enabled',false),
        jsonb_build_object('quality','ultra','price_credits',10,'estimated_provider_cost_usd',0,'target_margin',0.3,'credit_value_egp',0,'usd_to_egp',0,'resolution','1024x1024','enabled',false)
      )
    );
  exception when invalid_parameter_value then
    v_denied := true;
  end;
  if not v_denied then
    raise exception 'enabled price with missing credit/FX conversion was not rejected';
  end if;
end;
$$;

reset role;
rollback;

select 'PASS: media model admin save is guarded, atomic, audited, and rejects unpriced activation' as result;
