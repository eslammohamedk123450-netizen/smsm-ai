-- Regression for scheduler recovery of terminal jobs missed by an earlier worker.
-- The test intentionally inserts a terminal job without firing the status-update trigger;
-- the batch sweep must release both unused reservations exactly once.
begin;
select set_config('request.jwt.claim.role', 'service_role', true);

do $$
declare
  v_user uuid;
  v_task uuid := gen_random_uuid();
  v_job uuid;
  v_brain jsonb;
  v_wallet jsonb;
  v_sweep jsonb;
  v_hold public.suly_credit_holds%rowtype;
  v_event public.brain_usage_events%rowtype;
  v_before integer;
  v_after integer;
begin
  select user_id into v_user
    from public.suly_credit_accounts
   where balance > 20
   order by updated_at desc
   limit 1;
  if v_user is null then raise exception 'No test wallet available'; end if;

  v_brain := public.brain_reserve_usage(v_user, v_task, 100);
  if coalesce((v_brain->>'allowed')::boolean, false) is not true then
    raise exception 'Brain reserve failed: %', v_brain;
  end if;
  v_wallet := public.reserve_credits(v_user, v_task, 10, null);
  if coalesce((v_wallet->>'success')::boolean, false) is not true then
    raise exception 'Wallet reserve failed: %', v_wallet;
  end if;

  insert into public.agent_task_jobs(
    user_id, task_id, job_type, payload, idempotency_key, status, completed_at
  ) values (
    v_user, v_task, 'brain_task', '{}'::jsonb,
    'terminal-sweep-regression-' || gen_random_uuid()::text,
    'failed', now()
  ) returning id into v_job;

  select count(*) into v_before
    from public.suly_credit_transactions
   where hold_id = v_task and event_type = 'settle';

  v_sweep := public.settle_terminal_agent_task_usage_batch(200);
  select * into v_hold from public.suly_credit_holds where task_id = v_task and user_id = v_user;
  select * into v_event from public.brain_usage_events where task_id = v_task and user_id = v_user;

  if coalesce((v_sweep->>'settled')::integer, 0) < 1 then
    raise exception 'Terminal sweep did not process the missed job: %', v_sweep;
  end if;
  if v_hold.status <> 'settled' or v_hold.charged_amount <> 0 then
    raise exception 'Unused wallet hold was not released: %', row_to_json(v_hold);
  end if;
  if v_event.status <> 'failed' or v_event.actual_tokens <> 0 then
    raise exception 'Unused Brain token reservation was not released: %', row_to_json(v_event);
  end if;

  perform public.settle_terminal_agent_task_usage_batch(200);
  select count(*) into v_after
    from public.suly_credit_transactions
   where hold_id = v_task and event_type = 'settle';
  if v_after <> v_before + 1 then
    raise exception 'Repeated terminal sweep created a duplicate wallet settlement';
  end if;
end $$;

rollback;
