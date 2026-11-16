-- Regression check: direct auth.uid() calls should be wrapped in scalar SELECTs.
do $$
declare
  v_remaining integer;
begin
  select count(*) into v_remaining
  from pg_policies
  where schemaname = 'public'
    and (
      (coalesce(qual,'') ilike '%auth.uid()%' and coalesce(qual,'') not ilike '%select auth.uid()%')
      or
      (coalesce(with_check,'') ilike '%auth.uid()%' and coalesce(with_check,'') not ilike '%select auth.uid()%')
    );
  if v_remaining <> 0 then
    raise exception 'rls_auth_initplan_regression: % policies still evaluate auth.uid() directly', v_remaining;
  end if;
end;
$$;
