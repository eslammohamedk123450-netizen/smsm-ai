-- Activation-attempt throttling regression.
-- Run inside a transaction; all counter changes are rolled back.
do $$
declare
  v_function text := 'public.suly_check_feature_activation_rate_limit(uuid)';
begin
  if not (select relrowsecurity from pg_class where oid = 'public.suly_ai_rate_limits'::regclass) then
    raise exception 'rate-limit table must keep RLS enabled';
  end if;
  if has_table_privilege('anon', 'public.suly_ai_rate_limits', 'select')
     or has_table_privilege('authenticated', 'public.suly_ai_rate_limits', 'select')
     or has_table_privilege('anon', 'public.suly_ai_rate_limits', 'insert')
     or has_table_privilege('authenticated', 'public.suly_ai_rate_limits', 'insert')
     or has_table_privilege('anon', 'public.suly_ai_rate_limits', 'update')
     or has_table_privilege('authenticated', 'public.suly_ai_rate_limits', 'update') then
    raise exception 'client roles must not access rate-limit counters';
  end if;
  if has_function_privilege('anon', v_function, 'execute')
     or has_function_privilege('authenticated', v_function, 'execute') then
    raise exception 'client roles must not execute activation rate-limit RPC';
  end if;
  if not has_function_privilege('service_role', v_function, 'execute') then
    raise exception 'service_role must execute activation rate-limit RPC';
  end if;
  if not exists (
    select 1 from pg_proc
    where oid = v_function::regprocedure
      and prosecdef
      and coalesce(array_to_string(proconfig, ','), '') like '%search_path=pg_catalog, public, auth%'
  ) then
    raise exception 'activation limiter must be SECURITY DEFINER with a fixed search_path';
  end if;
  if pg_get_functiondef(v_function::regprocedure) not ilike '%for update%' then
    raise exception 'activation limiter must serialize per-user attempts with a row lock';
  end if;
end;
$$;

begin;
select set_config('request.jwt.claim.role', 'service_role', true);
set local role service_role;

do $$
declare
  v_user_id uuid;
  v_result jsonb;
  i integer;
begin
  select id into v_user_id from public.suly_profiles limit 1;
  if v_user_id is null then
    raise exception 'regression test requires at least one existing auth user';
  end if;

  insert into public.suly_ai_rate_limits (
    user_id, activation_window_started_at, activation_attempt_count, activation_last_attempt_at
  )
  values (
    v_user_id, clock_timestamp() - interval '16 minutes', 0, null
  )
  on conflict (user_id) do update set
    activation_window_started_at = excluded.activation_window_started_at,
    activation_attempt_count = 0,
    activation_last_attempt_at = null;

  for i in 1..5 loop
    v_result := public.suly_check_feature_activation_rate_limit(v_user_id);
    if v_result->>'allowed' <> 'true' then
      raise exception 'attempt % should be allowed, got %', i, v_result;
    end if;
    update public.suly_ai_rate_limits
      set activation_last_attempt_at = clock_timestamp() - interval '4 seconds'
      where user_id = v_user_id;
  end loop;

  v_result := public.suly_check_feature_activation_rate_limit(v_user_id);
  if v_result->>'allowed' <> 'false'
     or v_result->>'reason' <> 'activation_attempt_limit' then
    raise exception 'sixth attempt must be blocked by the 15-minute limit, got %', v_result;
  end if;

  update public.suly_ai_rate_limits
    set activation_window_started_at = clock_timestamp(),
        activation_attempt_count = 0,
        activation_last_attempt_at = clock_timestamp() - interval '1 second'
    where user_id = v_user_id;

  v_result := public.suly_check_feature_activation_rate_limit(v_user_id);
  if v_result->>'allowed' <> 'false'
     or v_result->>'reason' <> 'activation_cooldown' then
    raise exception 'attempt inside the 3-second cooldown must be blocked, got %', v_result;
  end if;

  update public.suly_ai_rate_limits
    set activation_window_started_at = clock_timestamp() - interval '16 minutes',
        activation_attempt_count = 0,
        activation_last_attempt_at = null
    where user_id = v_user_id;

  v_result := public.suly_check_feature_activation_rate_limit(v_user_id);
  if v_result->>'allowed' <> 'true' then
    raise exception 'expired window must reset and allow a new attempt, got %', v_result;
  end if;
end;
$$;

reset role;
rollback;

select 'PASS: activation attempt limits, cooldown, reset, row-lock and client ACL checks' as result;
