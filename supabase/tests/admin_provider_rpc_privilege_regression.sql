begin;

do $$
declare
  v_function regprocedure :=
    'public.suly_admin_add_provider(uuid,text,text,text,text,text)'::regprocedure;
begin
  if has_function_privilege('anon', v_function, 'EXECUTE') then
    raise exception 'anon must not execute suly_admin_add_provider';
  end if;
  if has_function_privilege('authenticated', v_function, 'EXECUTE') then
    raise exception 'authenticated must not execute suly_admin_add_provider';
  end if;
  if not has_function_privilege('service_role', v_function, 'EXECUTE') then
    raise exception 'service_role must execute suly_admin_add_provider';
  end if;
end;
$$;

rollback;
