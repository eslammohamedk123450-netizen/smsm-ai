-- Regression checks for provider secret isolation from client roles.
do $$
declare
  v_result_type text;
begin
  if has_table_privilege('anon', 'public.ai_providers', 'select') then
    raise exception 'anon must not be able to read provider records';
  end if;

  if has_table_privilege('authenticated', 'public.ai_providers', 'select') then
    raise exception 'authenticated clients must not be able to read provider records or credentials';
  end if;

  if not has_table_privilege('service_role', 'public.ai_providers', 'select') then
    raise exception 'service_role must retain server-side provider read access';
  end if;

  if not has_function_privilege('authenticated', 'public.suly_admin_list_providers()', 'execute') then
    raise exception 'authenticated admins must retain the safe provider-list RPC';
  end if;

  if has_function_privilege('anon', 'public.suly_admin_list_providers()', 'execute') then
    raise exception 'anonymous users must not execute the admin provider-list RPC';
  end if;

  select pg_get_function_result('public.suly_admin_list_providers()'::regprocedure)
    into v_result_type;

  if v_result_type ~* '(api_key|vault|credential|secret)' then
    raise exception 'provider-list RPC result must not expose secret-related fields: %', v_result_type;
  end if;
end;
$$;

begin;
select set_config('request.jwt.claim.sub', gen_random_uuid()::text, true);
select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;
do $$
declare
  v_denied boolean := false;
begin
  if has_table_privilege(current_user, 'public.ai_providers', 'select') then
    raise exception 'authenticated role still has direct provider table SELECT';
  end if;

  begin
    perform * from public.suly_admin_list_providers();
  exception when others then
    if sqlstate = '42501' or sqlerrm ilike '%administrator%' then
      v_denied := true;
    else
      raise;
    end if;
  end;

  if not v_denied then
    raise exception 'non-admin authenticated user unexpectedly executed admin provider-list RPC';
  end if;
end;
$$;
reset role;
rollback;

select 'PASS: provider secrets are not readable by client roles' as result;
