-- Optimize direct auth.uid() calls in RLS expressions as statement-level initplans.
-- This preserves policy semantics while avoiding per-row auth context evaluation.
begin;
do $$
declare
  r record;
  v_qual text;
  v_check text;
  v_stmt text;
begin
  for r in
    select schemaname, tablename, policyname, qual, with_check
    from pg_policies
    where schemaname = 'public'
      and (
        (coalesce(qual,'') ilike '%auth.uid()%' and coalesce(qual,'') not ilike '%select auth.uid()%')
        or
        (coalesce(with_check,'') ilike '%auth.uid()%' and coalesce(with_check,'') not ilike '%select auth.uid()%')
      )
  loop
    v_qual := r.qual;
    v_check := r.with_check;
    if v_qual is not null then
      v_qual := replace(v_qual, 'auth.uid()', '(select auth.uid())');
    end if;
    if v_check is not null then
      v_check := replace(v_check, 'auth.uid()', '(select auth.uid())');
    end if;
    v_stmt := format('alter policy %I on %I.%I', r.policyname, r.schemaname, r.tablename);
    if v_qual is not null then
      v_stmt := v_stmt || format(' using (%s)', v_qual);
    end if;
    if v_check is not null then
      v_stmt := v_stmt || format(' with check (%s)', v_check);
    end if;
    execute v_stmt;
  end loop;
end;
$$;
commit;
