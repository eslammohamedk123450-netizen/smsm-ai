-- Rollback-only regression: a duplicate code hash must never reactivate or mutate an old code.
-- Requires one active admin fixture. All inserted activation/audit rows are rolled back.
begin;

do $$
declare
  v_admin uuid;
  v_code text := 'HIMS-TEST-' || replace(gen_random_uuid()::text, '-', '');
  v_expiry timestamptz := now() + interval '1 day';
  v_created jsonb;
  v_id uuid;
  v_duplicate_rejected boolean := false;
  v_row public.suly_activation_codes%rowtype;
begin
  select a.user_id into v_admin
  from public.suly_admins a
  join public.suly_profiles p on p.id = a.user_id
  where p.is_banned = false
  order by a.created_at
  limit 1;

  if v_admin is null then
    raise exception 'No active admin fixture is available for the rollback-only regression';
  end if;

  perform set_config('request.jwt.claim.sub', v_admin::text, true);

  v_created := public.suly_admin_create_activation_code(
    'hims', v_code, 'collision-regression-original', 1, v_expiry
  );
  v_id := (v_created->>'id')::uuid;

  perform public.suly_admin_set_activation_code_active(v_id, false);

  begin
    perform public.suly_admin_create_activation_code(
      'hims', v_code, 'collision-regression-mutated', 999, now() + interval '30 days'
    );
  exception when unique_violation then
    v_duplicate_rejected := true;
  end;

  if not v_duplicate_rejected then
    raise exception 'Duplicate activation code was not rejected';
  end if;

  select * into v_row
  from public.suly_activation_codes
  where id = v_id;

  if not found
     or v_row.is_active is distinct from false
     or v_row.label is distinct from 'collision-regression-original'
     or v_row.max_uses is distinct from 1
     or v_row.expires_at is distinct from v_expiry then
    raise exception 'Duplicate code attempt mutated the original activation record';
  end if;
end;
$$;

rollback;
