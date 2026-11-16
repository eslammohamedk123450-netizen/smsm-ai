-- Run only against a disposable local/test database after applying the HIMS activation-code collision guard migration.
-- All fixture changes are rolled back. Never run this against production.
begin;

do $$
declare
  v_admin uuid := gen_random_uuid();
  v_code text := 'HIMS-COLLISION-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12));
  v_hash text;
  v_first jsonb;
  v_row public.suly_activation_codes%rowtype;
  v_duplicate_rejected boolean := false;
begin
  insert into auth.users (id, email)
  values (v_admin, 'hims-collision-' || v_admin::text || '@example.test');

  insert into public.suly_profiles (id, email)
  values (v_admin, 'hims-collision-' || v_admin::text || '@example.test');

  insert into public.suly_admins (user_id) values (v_admin);

  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object('role', 'authenticated', 'sub', v_admin)::text, true);

  v_first := public.suly_admin_create_activation_code('hims', v_code, 'original label', 7, null);
  if coalesce((v_first ->> 'success')::boolean, false) is not true then
    raise exception 'FAIL: initial activation code creation did not succeed';
  end if;

  v_hash := encode(digest(v_code, 'sha256'), 'hex');

  -- Simulate a code that has already been used and disabled by an administrator.
  update public.suly_activation_codes
  set used_count = 3, is_active = false, label = 'preserved state'
  where code_hash = v_hash;

  begin
    perform public.suly_admin_create_activation_code('hims', v_code, 'replacement label', 99, null);
  exception
    when unique_violation then
      v_duplicate_rejected := true;
  end;

  if not v_duplicate_rejected then
    raise exception 'FAIL: duplicate bearer code was not rejected';
  end if;

  select * into v_row
  from public.suly_activation_codes
  where code_hash = v_hash;

  if not found
    or v_row.used_count <> 3
    or v_row.is_active is distinct from false
    or v_row.label is distinct from 'preserved state'
    or v_row.max_uses <> 7
  then
    raise exception 'FAIL: duplicate attempt mutated the existing activation-code state';
  end if;

  raise notice 'PASS: duplicate activation-code hash is rejected and prior state remains unchanged';
end;
$$;

rollback;
