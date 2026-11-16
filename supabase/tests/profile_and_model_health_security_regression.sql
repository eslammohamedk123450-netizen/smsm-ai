-- Rollback-only regression for profile entitlement write isolation and admin RPC guards.
begin;

do $test$
declare
  v_admin uuid;
  v_user uuid;
  v_model_id integer;
  v_model_enabled boolean;
  v_auto_restricted boolean;
  v_result jsonb;
  v_provider_count integer;
  v_profile_name text;
begin
  select a.user_id into v_admin
  from public.suly_admins a
  join public.suly_profiles p on p.id = a.user_id
  where p.is_banned is false
  order by a.user_id
  limit 1;

  select p.id into v_user
  from public.suly_profiles p
  where p.is_banned is false
    and not exists (select 1 from public.suly_admins a where a.user_id = p.id)
  order by p.id
  limit 1;

  select m.id into v_model_id
  from public.ai_models m
  where m.enabled is false
  order by m.id
  limit 1;

  if v_admin is null or v_user is null or v_model_id is null then
    raise exception 'Regression fixtures missing: active admin, regular user, and disabled model are required';
  end if;

  if has_table_privilege('authenticated', 'public.suly_profiles', 'UPDATE')
     or has_table_privilege('authenticated', 'public.suly_profiles', 'INSERT')
     or has_table_privilege('authenticated', 'public.suly_profiles', 'DELETE') then
    raise exception 'Authenticated clients retain direct profile DML privileges';
  end if;
  if not has_table_privilege('authenticated', 'public.suly_profiles', 'SELECT') then
    raise exception 'Authenticated profile self-read was unexpectedly revoked';
  end if;
  if not has_table_privilege('service_role', 'public.suly_profiles', 'UPDATE') then
    raise exception 'Service role profile update was unexpectedly revoked';
  end if;

  if has_function_privilege('authenticated',
      'public.suly_media_register_self(text,text,text,text,text,text,bigint,text,jsonb)', 'EXECUTE') then
    raise exception 'Legacy media registration RPC remains executable by authenticated clients';
  end if;
  if not has_function_privilege('authenticated',
      'public.suly_media_register_self_v2(text,text,text,text,bigint,text,jsonb,uuid,uuid,uuid)', 'EXECUTE') then
    raise exception 'Supported media registration v2 RPC was unexpectedly revoked';
  end if;

  if pg_get_functiondef('public.suly_admin_set_provider_enabled(integer,boolean)'::regprocedure)
      not ilike '%suly_admin_set_provider_lifecycle%' then
    raise exception 'Legacy provider toggle does not delegate to the full lifecycle guard';
  end if;

  -- A normal user must still be able to update only the profile fields exposed
  -- by the safe SECURITY DEFINER profile RPC after direct table DML is revoked.
  perform set_config('request.jwt.claim.sub', v_user::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config('request.jwt.claims', jsonb_build_object(
    'sub', v_user::text, 'role', 'authenticated', 'email', 'security-regression@example.invalid'
  )::text, true);
  perform public.suly_upsert_my_profile(null, '__suly_profile_rpc_regression__', null);
  select full_name into v_profile_name from public.suly_profiles where id = v_user;
  if v_profile_name is distinct from '__suly_profile_rpc_regression__' then
    raise exception 'Safe profile RPC failed after direct DML revocation';
  end if;

  insert into public.ai_model_health(model_id, consecutive_failures, auto_restricted, restriction_reason, restricted_at)
  values (v_model_id, 7, true, 'regression_fixture', now())
  on conflict (model_id) do update set
    consecutive_failures = 7,
    auto_restricted = true,
    restriction_reason = 'regression_fixture',
    restricted_at = now();

  -- Admin identity simulation uses an existing active admin subject; no
  -- password/session secret is needed for this database authorization test.
  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_admin::text, 'role', 'authenticated')::text, true);

  select count(*) into v_provider_count from public.suly_admin_list_providers();
  v_result := public.suly_admin_reset_model_health(v_model_id);
  if coalesce((v_result ->> 'success')::boolean, false) is not true then
    raise exception 'Admin health reset did not report success';
  end if;

  select enabled into v_model_enabled from public.ai_models where id = v_model_id;
  select auto_restricted into v_auto_restricted from public.ai_model_health where model_id = v_model_id;
  if v_model_enabled is distinct from false then
    raise exception 'Health reset unexpectedly re-enabled an administratively disabled model';
  end if;
  if v_auto_restricted is distinct from false then
    raise exception 'Health reset did not clear the automatic health restriction';
  end if;

  -- The same admin RPCs must reject an ordinary authenticated identity.
  perform set_config('request.jwt.claim.sub', v_user::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_user::text, 'role', 'authenticated')::text, true);

  begin
    perform * from public.suly_admin_list_providers();
    raise exception 'Non-admin user unexpectedly accessed the admin provider listing';
  exception when insufficient_privilege then
    null;
  end;

  begin
    perform public.suly_admin_reset_model_health(v_model_id);
    raise exception 'Non-admin user unexpectedly passed the model health reset guard';
  exception when insufficient_privilege then
    null;
  end;
end;
$test$;

rollback;
