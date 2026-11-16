-- Rollback-only regression for profile entitlement write isolation and admin health reset.
begin;

do $test$
declare
  v_admin uuid;
  v_user uuid;
  v_model_id integer;
  v_model_enabled boolean;
  v_auto_restricted boolean;
  v_result jsonb;
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

  if has_function_privilege('authenticated',
      'public.suly_media_register_self(text,text,text,text,text,text,bigint,text,jsonb)', 'EXECUTE') then
    raise exception 'Legacy media registration RPC remains executable by authenticated clients';
  end if;

  insert into public.ai_model_health(model_id, consecutive_failures, auto_restricted, restriction_reason, restricted_at)
  values (v_model_id, 7, true, 'regression_fixture', now())
  on conflict (model_id) do update set
    consecutive_failures = 7,
    auto_restricted = true,
    restriction_reason = 'regression_fixture',
    restricted_at = now();

  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_admin::text, 'role', 'authenticated')::text, true);

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

  perform set_config('request.jwt.claim.sub', v_user::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_user::text, 'role', 'authenticated')::text, true);

  begin
    perform public.suly_admin_reset_model_health(v_model_id);
    raise exception 'Non-admin user unexpectedly passed the model health reset guard';
  exception when insufficient_privilege then
    null;
  end;
end;
$test$;

rollback;
