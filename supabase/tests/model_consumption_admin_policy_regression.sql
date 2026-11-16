-- Regression: model-consumption data is visible only through the canonical admin predicate.
do $$
declare
  v_qual text;
  v_roles text[];
  v_cmd text;
begin
  select qual, roles, cmd
    into v_qual, v_roles, v_cmd
  from pg_policies
  where schemaname = 'public'
    and tablename = 'model_consumption_logs'
    and policyname = 'Admins can view consumption';

  if v_qual is null
     or position('suly_is_admin' in v_qual) = 0
     or position('auth.jwt' in v_qual) > 0
     or v_cmd <> 'SELECT'
     or not ('authenticated' = any(v_roles)) then
    raise exception 'model_consumption_admin_policy_regression';
  end if;
end;
$$;
