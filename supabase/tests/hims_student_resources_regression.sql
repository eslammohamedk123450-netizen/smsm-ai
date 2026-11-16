-- HIMS student-resource authorization regression checks.
-- Run with a database owner in a disposable transaction.
begin;

-- An activated HIMS user can list the active HIMS resources.
select set_config(
  'request.jwt.claim.sub',
  (select user_id::text from public.suly_feature_activations where feature_key = 'hims' order by activated_at limit 1),
  true
);
set local role authenticated;
do $$
declare v_count integer;
begin
  select count(*) into v_count from public.suly_my_feature_resources(200, 0);
  if v_count < 1 then raise exception 'activated HIMS user could not list HIMS resources'; end if;
end;
$$;
reset role;

-- A signed-in user without an activation receives no HIMS resources.
select set_config('request.jwt.claim.sub', gen_random_uuid()::text, true);
set local role authenticated;
do $$
declare v_count integer;
begin
  select count(*) into v_count from public.suly_my_feature_resources(200, 0);
  if v_count <> 0 then raise exception 'unactivated user received HIMS resources'; end if;
end;
$$;
reset role;

rollback;
