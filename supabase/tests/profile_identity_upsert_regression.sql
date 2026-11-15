-- Regression: a caller cannot overwrite the profile email with an arbitrary value.
-- Run inside a transaction; all fixture/profile changes are rolled back.
begin;

do $test$
declare
  v_user_id uuid;
  v_verified_email text;
  v_stored_email text;
begin
  select id, email
    into v_user_id, v_verified_email
  from auth.users
  where email is not null
  order by created_at
  limit 1;

  if v_user_id is null then
    raise exception 'No auth user is available for the profile identity regression test';
  end if;

  perform set_config(
    'request.jwt.claims',
    jsonb_build_object(
      'sub', v_user_id::text,
      'role', 'authenticated',
      'email', v_verified_email
    )::text,
    true
  );

  perform public.suly_upsert_my_profile(
    'attacker-controlled@example.invalid',
    'Profile Identity Regression',
    null
  );

  select email into v_stored_email
  from public.suly_profiles
  where id = v_user_id;

  if v_stored_email is distinct from v_verified_email then
    raise exception 'Profile email spoofing regression: expected %, received %',
      v_verified_email, v_stored_email;
  end if;
end;
$test$;

rollback;
