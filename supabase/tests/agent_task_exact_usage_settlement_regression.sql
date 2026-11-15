-- Regression harness for terminal Agent task settlement.
-- Run after 20261115203000_agent_task_exact_usage_settlement.sql.
-- Uses a transaction and rolls back all fixtures and wallet/token changes.

begin;
select set_config('request.jwt.claim.role', 'service_role', true);

do $$
declare
  v_user uuid;
  v_task uuid;
  v_job uuid;
  v_brain jsonb;
  v_wallet jsonb;
  v_hold public.suly_credit_holds%rowtype;
  v_event public.brain_usage_events%rowtype;
  v_before_transactions integer;
  v_after_transactions integer;
begin
  select id into v_user from auth.users order by created_at limit 1;
  if v_user is null then
    raise exception 'At least one auth user is required for task settlement regression coverage';
  end if;

  -- Completed task: only provider-reported usage is charged and both reserves settle once.
  v_task := gen_random_uuid();
  v_brain := public.brain_reserve_usage(v_user, v_task, 100);
  if coalesce((v_brain->>'allowed')::boolean, false) is not true then
    raise exception 'Could not reserve Brain tokens for completed-task test: %', v_brain;
  end if;
  v_wallet := public.reserve_credits(v_user, v_task, 10, null);
  if coalesce((v_wallet->>'success')::boolean, false) is not true then
    raise exception 'Could not reserve wallet credits for completed-task test: %', v_wallet;
  end if;
  insert into public.agent_task_jobs(user_id, task_id, job_type, payload, idempotency_key, status, locked_by, lease_until)
  values (v_user, v_task, 'brain_task', '{}'::jsonb, 'exact-usage-completed-' || gen_random_uuid()::text, 'running', 'usage-test-worker', now() + interval '2 minutes')
  returning id into v_job;

  perform public.record_agent_step_usage(
    v_job, v_task, v_user, 'step-complete', 1, 'call-complete',
    null, 'regression-provider', 120, 45, 1,
    'completed', 'provider_reported', '{"fixture":true}'::jsonb
  );

  select count(*) into v_before_transactions
    from public.suly_credit_transactions
   where hold_id = v_task and event_type = 'settle';

  update public.agent_task_jobs
     set status = 'completed', completed_at = now()
   where id = v_job;

  select * into v_hold from public.suly_credit_holds where task_id = v_task;
  select * into v_event from public.brain_usage_events where task_id = v_task;
  if v_hold.status <> 'settled' or v_hold.charged_amount <> 1 or v_hold.input_tokens <> 120 or v_hold.output_tokens <> 45 then
    raise exception 'Completed task wallet settlement is incorrect: %', row_to_json(v_hold);
  end if;
  if v_event.status <> 'completed' or v_event.actual_tokens <> 165 then
    raise exception 'Completed task Brain token settlement is incorrect: %', row_to_json(v_event);
  end if;

  perform public.finalize_agent_task_usage(v_job, v_task, v_user);
  select count(*) into v_after_transactions
    from public.suly_credit_transactions
   where hold_id = v_task and event_type = 'settle';
  if v_after_transactions <> v_before_transactions + 1 then
    raise exception 'Repeated settlement created a duplicate wallet transaction';
  end if;

  -- Unknown provider usage blocks settlement even after the job is terminal.
  v_task := gen_random_uuid();
  v_brain := public.brain_reserve_usage(v_user, v_task, 100);
  if coalesce((v_brain->>'allowed')::boolean, false) is not true then
    raise exception 'Could not reserve Brain tokens for unknown-usage test: %', v_brain;
  end if;
  v_wallet := public.reserve_credits(v_user, v_task, 10, null);
  if coalesce((v_wallet->>'success')::boolean, false) is not true then
    raise exception 'Could not reserve wallet credits for unknown-usage test: %', v_wallet;
  end if;
  insert into public.agent_task_jobs(user_id, task_id, job_type, payload, idempotency_key, status, locked_by, lease_until)
  values (v_user, v_task, 'brain_task', '{}'::jsonb, 'exact-usage-unknown-' || gen_random_uuid()::text, 'running', 'usage-test-worker', now() + interval '2 minutes')
  returning id into v_job;

  perform public.record_agent_step_usage(
    v_job, v_task, v_user, 'step-unknown', 1, 'call-unknown',
    null, 'regression-provider', null, null, null,
    'unknown', 'unavailable', '{"fixture":true}'::jsonb
  );
  -- Exercise the real owner-checked queued-cancellation RPC and its settlement trigger.
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config('request.jwt.claim.sub', v_user::text, true);
  perform public.cancel_agent_task_job(v_job);
  perform set_config('request.jwt.claim.role', 'service_role', true);

  select * into v_hold from public.suly_credit_holds where task_id = v_task;
  select * into v_event from public.brain_usage_events where task_id = v_task;
  if v_hold.status <> 'held' or v_event.status <> 'reserved' then
    raise exception 'Unknown provider usage was charged or released unsafely';
  end if;

  -- A trustworthy late provider report reconciles the unknown row and auto-settles the terminal task.
  perform public.record_agent_step_usage(
    v_job, v_task, v_user, 'step-unknown', 1, 'call-unknown',
    null, 'regression-provider', 80, 20, 1,
    'partial', 'provider_reported_partial', '{"fixture":true,"late":true}'::jsonb
  );
  select * into v_hold from public.suly_credit_holds where task_id = v_task;
  select * into v_event from public.brain_usage_events where task_id = v_task;
  if v_hold.status <> 'settled' or v_hold.charged_amount <> 1 then
    raise exception 'Late usage did not settle wallet credits: %', row_to_json(v_hold);
  end if;
  if v_event.status <> 'cancelled' or v_event.actual_tokens <> 100 then
    raise exception 'Late usage did not finalize Brain tokens: %', row_to_json(v_event);
  end if;

  -- Queued cancellation before any provider call releases both reservations at zero cost.
  v_task := gen_random_uuid();
  v_brain := public.brain_reserve_usage(v_user, v_task, 100);
  if coalesce((v_brain->>'allowed')::boolean, false) is not true then
    raise exception 'Could not reserve Brain tokens for queued-cancel test: %', v_brain;
  end if;
  v_wallet := public.reserve_credits(v_user, v_task, 10, null);
  if coalesce((v_wallet->>'success')::boolean, false) is not true then
    raise exception 'Could not reserve wallet credits for queued-cancel test: %', v_wallet;
  end if;
  insert into public.agent_task_jobs(user_id, task_id, job_type, payload, idempotency_key, status)
  values (v_user, v_task, 'brain_task', '{}'::jsonb, 'exact-usage-queued-cancel-' || gen_random_uuid()::text, 'queued')
  returning id into v_job;
  update public.agent_task_jobs
     set status = 'cancelled', completed_at = now()
   where id = v_job;

  select * into v_hold from public.suly_credit_holds where task_id = v_task;
  select * into v_event from public.brain_usage_events where task_id = v_task;
  if v_hold.status <> 'settled' or v_hold.charged_amount <> 0 then
    raise exception 'Queued cancellation did not release wallet hold at zero cost: %', row_to_json(v_hold);
  end if;
  if v_event.status <> 'cancelled' or v_event.actual_tokens <> 0 then
    raise exception 'Queued cancellation did not release Brain token reservation: %', row_to_json(v_event);
  end if;
end $$;

rollback;
