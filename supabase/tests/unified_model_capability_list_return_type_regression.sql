-- Regression for provider_name VARCHAR -> TEXT return type mismatch.
-- Run with a database owner in a disposable transaction after applying the fix.
begin;

select set_config(
  'request.jwt.claim.sub',
  (select user_id::text from public.suly_admins order by user_id limit 1),
  true
);
set local role authenticated;

do $admin$
declare
  v_rows bigint;
begin
  if not public.suly_is_admin() then
    raise exception 'admin test context was not recognized';
  end if;

  select count(*) into v_rows
  from public.suly_admin_list_unified_model_capabilities();

  if v_rows < 0 then
    raise exception 'unreachable row count guard';
  end if;
end;
$admin$;

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', true);

do $non_admin$
begin
  if public.suly_is_admin() then
    raise exception 'non-admin test context was unexpectedly admin';
  end if;

  begin
    perform 1 from public.suly_admin_list_unified_model_capabilities();
    raise exception 'non-admin was allowed to list unified model capabilities';
  exception
    when insufficient_privilege then null;
  end;
end;
$non_admin$;

rollback;
