-- SULY Phase 1 security-boundary regression checks.
-- Metadata-only assertions: safe to run against a production database.
-- No rows are inserted/updated/deleted and no schema changes are performed.

begin;

do $$
declare
  v_count integer;
  v_function regprocedure;
  v_definition text;
  v_config text[];
begin
  -- Every RLS-enabled public table without a policy must remain inaccessible
  -- directly to anon/authenticated. Service-only tables are intentionally
  -- protected by grants rather than user-facing policies.
  select count(*) into v_count
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind = 'r'
    and c.relrowsecurity
    and not exists (
      select 1 from pg_policies p
      where p.schemaname = n.nspname and p.tablename = c.relname
    )
    and (
      has_table_privilege('anon', c.oid, 'SELECT')
      or has_table_privilege('anon', c.oid, 'INSERT')
      or has_table_privilege('anon', c.oid, 'UPDATE')
      or has_table_privilege('anon', c.oid, 'DELETE')
      or has_table_privilege('authenticated', c.oid, 'SELECT')
      or has_table_privilege('authenticated', c.oid, 'INSERT')
      or has_table_privilege('authenticated', c.oid, 'UPDATE')
      or has_table_privilege('authenticated', c.oid, 'DELETE')
    );
  if v_count <> 0 then
    raise exception 'RLS tables without policies have direct anon/authenticated grants: %', v_count;
  end if;

  -- Public SECURITY DEFINER RPC exposure is intentional only for the
  -- conversation-share token endpoint; every other definer RPC must not be
  -- executable by anon.
  select count(*) into v_count
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.prosecdef
    and has_function_privilege('anon', p.oid, 'EXECUTE')
    and p.oid <> 'public.suly_get_public_conversation(uuid)'::regprocedure;
  if v_count <> 0 then
    raise exception 'Unexpected anon-executable SECURITY DEFINER functions: %', v_count;
  end if;

  v_function := 'public.suly_get_public_conversation(uuid)'::regprocedure;
  select p.proconfig, pg_get_functiondef(p.oid)
    into v_config, v_definition
  from pg_proc p where p.oid = v_function;
  if not has_function_privilege('anon', v_function, 'EXECUTE')
     or not coalesce(v_config::text, '') like '%search_path=%'
     or position('share_token = p_share_token' in v_definition) = 0 then
    raise exception 'Public conversation share RPC lost its token-scoped security boundary';
  end if;

  -- Provider compatibility wrappers must delegate to the v2 implementation,
  -- which enforces suly_is_admin(), rather than bypassing authorization.
  select pg_get_functiondef('public.suly_admin_set_provider_enabled(integer,boolean)'::regprocedure)
    into v_definition;
  if position('suly_admin_set_provider_lifecycle(' in v_definition) = 0 then
    raise exception 'Provider enabled wrapper no longer delegates to lifecycle RPC';
  end if;

  select pg_get_functiondef('public.suly_admin_set_provider_lifecycle(integer,boolean,boolean)'::regprocedure)
    into v_definition;
  if position('suly_admin_set_provider_lifecycle_v2(' in v_definition) = 0 then
    raise exception 'Provider lifecycle wrapper no longer delegates to v2 RPC';
  end if;

  select pg_get_functiondef('public.suly_admin_set_provider_lifecycle_v2(integer,boolean,boolean)'::regprocedure)
    into v_definition;
  if position('suly_is_admin()' in v_definition) = 0 then
    raise exception 'Provider lifecycle v2 is missing its administrator authorization guard';
  end if;

  -- All exposed SECURITY DEFINER functions must pin search_path explicitly.
  select count(*) into v_count
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.prosecdef
    and (has_function_privilege('anon', p.oid, 'EXECUTE')
      or has_function_privilege('authenticated', p.oid, 'EXECUTE'))
    and not exists (
      select 1 from unnest(coalesce(p.proconfig, array[]::text[])) cfg
      where cfg like 'search_path=%'
    );
  if v_count <> 0 then
    raise exception 'Exposed SECURITY DEFINER functions without pinned search_path: %', v_count;
  end if;
end;
$$;

rollback;
