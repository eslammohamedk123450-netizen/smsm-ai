-- Regression checks for reversible provider archive/restore.
do $$
declare
  v_definition text;
begin
  if not exists (
    select 1 from pg_class c
    join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relname='ai_provider_lifecycle_snapshots'
      and c.relrowsecurity is true
  ) then
    raise exception 'provider lifecycle snapshot table must have RLS enabled';
  end if;

  if has_table_privilege('anon','public.ai_provider_lifecycle_snapshots','select')
     or has_table_privilege('authenticated','public.ai_provider_lifecycle_snapshots','select') then
    raise exception 'client roles must not read provider lifecycle snapshots';
  end if;

  if has_function_privilege('anon','public.suly_admin_set_provider_lifecycle_v2(integer,boolean,boolean)','execute')
     or has_function_privilege('anon','public.suly_admin_list_archived_providers()','execute') then
    raise exception 'anonymous role must not execute provider archive admin RPCs';
  end if;

  if pg_get_function_result('public.suly_admin_set_provider_lifecycle_v2(integer,boolean,boolean)'::regprocedure) <> 'jsonb' then
    raise exception 'versioned provider lifecycle RPC must return a verifiable JSON result';
  end if;

  select pg_get_functiondef('public.suly_admin_set_provider_lifecycle_v2(integer,boolean,boolean)'::regprocedure)
    into v_definition;

  if v_definition ilike '%delete from public.%ledger%'
     or v_definition ilike '%delete from public.%transaction%'
     or v_definition ilike '%truncate%ledger%' then
    raise exception 'provider archive/restore must never delete or truncate financial history';
  end if;

  if position('ai_provider_lifecycle_snapshots' in v_definition) = 0
     or position('restored_at' in v_definition) = 0 then
    raise exception 'provider lifecycle must persist and track a reversible snapshot';
  end if;

  if pg_get_functiondef('public.suly_admin_set_provider_lifecycle(integer,boolean,boolean)'::regprocedure)
       not ilike '%suly_admin_set_provider_lifecycle_v2%' then
    raise exception 'legacy provider lifecycle RPC must delegate to reversible v2';
  end if;
end;
$$;

select 'PASS: provider archive is reversible, admin-only, and preserves financial history' as result;
