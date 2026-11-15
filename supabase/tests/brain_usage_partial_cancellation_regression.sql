begin;

select set_config('request.jwt.claim.role', 'service_role', true);

do $$
declare
  v_user uuid;
  v_task uuid := gen_random_uuid();
  v_reservation jsonb;
  v_first jsonb;
  v_repeat jsonb;
  v_used_before integer;
  v_reserved_before integer;
  v_used_after integer;
  v_reserved_after integer;
begin
  select user_id into v_user
    from public.suly_credit_accounts
   where balance > 0
   order by updated_at desc
   limit 1;
  if v_user is null then
    raise exception 'No test user with a credit account is available';
  end if;

  select coalesce(tokens_used, 0), coalesce(tokens_reserved, 0)
    into v_used_before, v_reserved_before
    from public.brain_usage_daily
   where user_id = v_user and usage_date = current_date;

  v_reservation := public.brain_reserve_usage(v_user, v_task, 100);
  if coalesce((v_reservation->>'allowed')::boolean, false) is not true then
    raise exception 'Brain usage reservation failed: %', v_reservation;
  end if;

  -- A running task was cancelled after one provider step completed.
  v_first := public.brain_finalize_usage(v_task, 35, 'cancelled');
  if coalesce((v_first->>'finalized')::boolean, false) is not true
     or coalesce((v_first->>'actual_tokens')::integer, -1) <> 35
     or v_first->>'status' <> 'cancelled' then
    raise exception 'Partial cancellation usage was not finalized: %', v_first;
  end if;

  v_repeat := public.brain_finalize_usage(v_task, 35, 'cancelled');
  if coalesce((v_repeat->>'finalized')::boolean, true) is not false then
    raise exception 'Repeated cancellation charged Brain usage more than once: %', v_repeat;
  end if;

  select coalesce(tokens_used, 0), coalesce(tokens_reserved, 0)
    into v_used_after, v_reserved_after
    from public.brain_usage_daily
   where user_id = v_user and usage_date = current_date;

  if v_used_after - v_used_before <> 35 then
    raise exception 'Expected exactly 35 actual tokens to be charged; delta was %', v_used_after - v_used_before;
  end if;
  if v_reserved_after - v_reserved_before <> 0 then
    raise exception 'Unused reservation was not released; delta was %', v_reserved_after - v_reserved_before;
  end if;
end;
$$;

rollback;
